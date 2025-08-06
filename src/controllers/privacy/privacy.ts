import {
  Circuits,
  CommitmentProof,
  PrivacyPoolSDK,
  WithdrawalProofInput,
  calculateContext,
  Withdrawal,
  generateMerkleProof,
  Hash,
  WithdrawalProof,
  AccountService,
  DataService,
  PoolAccount as SDKPoolAccount,
  AccountCommitment,
  ChainConfig,
  RagequitEvent,
  PoolInfo
} from '@0xbow/privacy-pools-core-sdk'
import type { Address } from 'ethereumjs-util'
import { type Chain, createPublicClient } from 'viem'
import { chainData, whitelistedChains, getTransportRpcUrl } from './config'
import { getTimestampFromBlockNumber } from '../../utils/privacy'
import type { ChainData } from './config'
import EventEmitter from '../eventEmitter/eventEmitter'

// TODO: Move this to types file
type RagequitEventWithTimestamp = RagequitEvent & {
  timestamp: bigint
}

// TODO: Move this to types file
export type PoolAccount = SDKPoolAccount & {
  name: number
  balance: bigint // has spendable commitments, check with getSpendableCommitments()
  isValid: boolean // included in ASP leaves
  reviewStatus: ReviewStatus // ASP status
  lastCommitment: AccountCommitment
  chainId: number
  scope: Hash
  ragequit?: RagequitEventWithTimestamp
}

export enum ReviewStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  DECLINED = 'declined',
  EXITED = 'exited',
  SPENT = 'spent'
}

// Extends EventEmitter when using in ambire-common
export class PrivacyController extends EventEmitter {
  #accountService: AccountService | null = null

  #sdk: PrivacyPoolSDK | null = null

  #dataService: DataService | null = null

  #selectedPool: PoolInfo | null = null

  amount: string = ''

  targetAddress: Address | string = '' //  TODO: review this type on ambire

  selectedToken: string = ''

  selectedPoolAccount: PoolAccount | null = null

  constructor() {
    super()

    const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''
    if (!baseUrl) throw new Error('SDK can only be initialized on client-side') // TODO: fix this, will probably fail in server-side

    const circuits = new Circuits({ baseUrl })
    this.#sdk = new PrivacyPoolSDK(circuits)

    const dataServiceConfig: ChainConfig[] = PrivacyController.poolsByChain().map((pool) => {
      return {
        chainId: pool.chainId,
        privacyPoolAddress: pool.address,
        startBlock: pool.deploymentBlock,
        rpcUrl: chainData[pool.chainId].sdkRpcUrl,
        apiKey: 'sdk' // It's not an api key https://viem.sh/docs/clients/public#key-optional
      }
    })

    this.#dataService = new DataService(dataServiceConfig)
    this.emitUpdate()
  }

  private static poolByChainId(chainId: number) {
    return PrivacyController.poolsByChain().find((pool) => pool.chainId === chainId)
  }

  private static chainDataByWhitelistedChains(): ChainData[keyof ChainData][] {
    const filteredChainData = Object.values(chainData).filter(
      (chain) =>
        chain.poolInfo.length > 0 &&
        whitelistedChains.some((c) => c.id === chain.poolInfo[0].chainId)
    )
    return filteredChainData
  }

  private static poolsByChain() {
    return PrivacyController.chainDataByWhitelistedChains().flatMap((chain) => chain.poolInfo)
  }

  private static pools(): PoolInfo[] {
    return PrivacyController.poolsByChain().map((pool) => {
      return {
        chainId: pool.chainId,
        address: pool.address,
        scope: pool.scope as Hash,
        deploymentBlock: pool.deploymentBlock
      }
    })
  }

  public async updateForm({
    amount,
    targetAddress,
    selectedToken,
    selectedPoolAccount
  }: {
    amount?: string
    targetAddress?: Address | string
    selectedToken?: string
    selectedPoolAccount?: PoolAccount
  }) {
    if (amount) {
      this.amount = amount
    }
    if (targetAddress) {
      this.targetAddress = targetAddress
    }
    if (selectedToken) {
      this.selectedToken = selectedToken

      const pool = PrivacyController.poolByChainId(11155111)
      if (!pool) {
        throw new Error('Pool not found')
      }

      this.#selectedPool = { ...pool, scope: pool.scope as Hash }
    }
    if (selectedPoolAccount) {
      this.selectedPoolAccount = selectedPoolAccount
    }

    this.emitUpdate()
  }

  public resetForm() {
    this.amount = ''
    this.targetAddress = ''
    this.selectedToken = ''
    this.#selectedPool = null
    this.selectedPoolAccount = null
  }

  /**
   * Generates a zero-knowledge proof for a commitment using Poseidon hash.
   *
   * @param value - The value being committed to
   * @param label - Label associated with the commitment
   * @param nullifier - Unique nullifier for the commitment
   * @param secret - Secret key for the commitment
   * @returns Promise resolving to proof and public signals
   * @throws {ProofError} If proof generation fails
   */
  public async generateRagequitProof(commitment: AccountCommitment): Promise<CommitmentProof> {
    if (!this.#sdk) throw new Error('SDK not initialized')

    return this.#sdk.proveCommitment(
      commitment.value,
      commitment.label,
      commitment.nullifier,
      commitment.secret
    )
  }

  /**
   * Verifies a commitment proof.
   *
   * @param proof - The commitment proof to verify
   * @param publicSignals - Public signals associated with the proof
   * @returns Promise resolving to boolean indicating proof validity
   * @throws {ProofError} If verification fails
   */
  public async verifyRagequitProof({ proof, publicSignals }: CommitmentProof) {
    if (!this.#sdk) throw new Error('SDK not initialized')

    return this.#sdk.verifyCommitment({ proof, publicSignals })
  }

  /**
   * Generates a withdrawal proof.
   *
   * @param commitment - Commitment to withdraw
   * @param input - Input parameters for the withdrawal
   * @param withdrawal - Withdrawal details
   * @returns Promise resolving to withdrawal payload
   * @throws {ProofError} If proof generation fails
   */
  public async generateWithdrawalProof(commitment: AccountCommitment, input: WithdrawalProofInput) {
    if (!this.#sdk) throw new Error('SDK not initialized')

    return this.#sdk.proveWithdrawal(
      {
        preimage: {
          label: commitment.label,
          value: commitment.value,
          precommitment: {
            hash: BigInt('0x1234') as Hash,
            nullifier: commitment.nullifier,
            secret: commitment.secret
          }
        },
        hash: commitment.hash,
        nullifierHash: BigInt('0x1234') as Hash
      },
      input
    )
  }

  public async verifyWithdrawalProof(proof: WithdrawalProof) {
    if (!this.#sdk) {
      throw new Error('SDK not initialized')
    }

    return this.#sdk.verifyWithdrawal(proof)
  }

  /**
   * Always recreate the accountService -because we cannot store
   * the seed in memory due to security issues- and retrieve history
   */
  public async loadAccount(seed: string) {
    if (!this.#dataService) {
      throw new Error('DataService not initialized')
    }

    this.#accountService = new AccountService(this.#dataService, { mnemonic: seed })
    await this.#accountService.retrieveHistory(PrivacyController.pools())
  }

  public createDepositSecrets(scope: Hash) {
    if (!this.#accountService) {
      throw new Error('AccountService not initialized')
    }

    return this.#accountService.createDepositSecrets(scope)
  }

  public createWithdrawalSecrets(commitment: AccountCommitment) {
    if (!this.#accountService) {
      throw new Error('AccountService not initialized')
    }

    return this.#accountService.createWithdrawalSecrets(commitment)
  }

  // TODO: Should those function to be in utils?
  public static getContext(withdrawal: Withdrawal, scope: Hash) {
    return calculateContext(withdrawal, scope)
  }

  public static getMerkleProof(leaves: bigint[], leaf: bigint) {
    return generateMerkleProof(leaves, leaf)
  }

  public async getPoolAccountsFromAccount(chainId: number) {
    if (!this.#accountService) {
      throw new Error('AccountService not initialized')
    }

    const paMap = this.#accountService.account.poolAccounts.entries()
    const poolAccounts: PoolAccount[] = []

    Array.from(paMap).forEach(([scope, poolAccountsArray]) => {
      poolAccountsArray.forEach(async (poolAccount, idx) => {
        const lastCommitment =
          poolAccount.children.length > 0
            ? poolAccount.children[poolAccount.children.length - 1]
            : poolAccount.deposit

        const chainIdKey = Object.keys(chainData).find((key) =>
          chainData[Number(key)].poolInfo.some((pool) => pool.scope === scope)
        )

        const updatedPoolAccount: PoolAccount = {
          ...(poolAccount as PoolAccount),
          balance: lastCommitment!.value,
          lastCommitment,
          reviewStatus: ReviewStatus.PENDING,
          isValid: false,
          name: idx + 1, // Use idx from forEach instead of manual counter
          scope,
          chainId: Number(chainIdKey)
        }

        const publicClient = createPublicClient({
          chain: whitelistedChains.find((chain: Chain) => chain.id === Number(chainIdKey)),
          transport: getTransportRpcUrl[Number(chainId)]
        })

        updatedPoolAccount.deposit.timestamp = await getTimestampFromBlockNumber(
          poolAccount.deposit.blockNumber,
          publicClient
        )

        if (updatedPoolAccount.children.length > 0) {
          updatedPoolAccount.children.forEach(async (child) => {
            child.timestamp = await getTimestampFromBlockNumber(child.blockNumber, publicClient)
          })
        }

        if (updatedPoolAccount.ragequit) {
          updatedPoolAccount.balance = 0n
          updatedPoolAccount.reviewStatus = ReviewStatus.EXITED
        }

        if (updatedPoolAccount.ragequit) {
          updatedPoolAccount.ragequit.timestamp = await getTimestampFromBlockNumber(
            updatedPoolAccount.ragequit.blockNumber,
            publicClient
          )
        }

        poolAccounts.push(updatedPoolAccount)
      })
    })

    const poolAccountsByChainScope = poolAccounts.reduce((acc, curr) => {
      acc[`${curr.chainId}-${curr.scope}`] = [...(acc[`${curr.chainId}-${curr.scope}`] || []), curr]
      return acc
    }, {} as Record<string, PoolAccount[]>)
    const poolAccountsByCurrentChain = poolAccounts.filter((pa) => pa.chainId === chainId)

    return { poolAccounts: poolAccountsByCurrentChain, poolAccountsByChainScope }
  }

  toJSON() {
    return {
      ...this,
      ...super.toJSON()
    }
  }
}
