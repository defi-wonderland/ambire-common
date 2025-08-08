import { type Address, type Chain, createPublicClient, type Hex } from 'viem'
import { chainData, whitelistedChains } from './config'
import type { ChainData } from './config'
import EventEmitter from '../eventEmitter/eventEmitter'

export type PoolInfo = {
  chainId: number
  address: Hex
  scope: Hash
  deploymentBlock: bigint
}

type Hash = bigint & {
  readonly __brand: unique symbol
}

type Secret = bigint & {
  readonly __brand: unique symbol
}

interface AccountCommitment {
  hash: Hash
  value: bigint
  label: Hash
  nullifier: Secret
  secret: Secret
  blockNumber: bigint
  timestamp?: bigint
  txHash: Hex
}

interface RagequitEvent {
  ragequitter: string
  commitment: Hash
  label: Hash
  value: bigint
  blockNumber: bigint
  transactionHash: Hex
}

interface PoolAccount {
  label: Hash
  deposit: AccountCommitment
  children: AccountCommitment[]
  ragequit?: RagequitEvent
}

// Extends EventEmitter when using in ambire-common
export class PrivacyController extends EventEmitter {
  // Holds the initial load promise, so that one can wait until it completes
  #initialLoadPromise: Promise<void>

  selectedPool: PoolInfo | null = null

  poolsByChain: any = []

  pools: any[] = []

  chainDataByWhitelistedChains: ChainData[keyof ChainData][] = []

  chainData: ChainData | null = null

  amount: string = ''

  targetAddress: Address | string = '' //  TODO: review this type on ambire

  selectedToken: string = ''

  selectedPoolAccount: PoolAccount | null = null

  constructor() {
    super()
    this.#initialLoadPromise = this.#load()
  }

  async #load() {
    this.chainDataByWhitelistedChains = Object.values(chainData).filter(
      (chain) =>
        chain.poolInfo.length > 0 &&
        whitelistedChains.some((c) => c.id === chain.poolInfo[0].chainId)
    )

    this.poolsByChain = this.chainDataByWhitelistedChains.flatMap((chain) => chain.poolInfo)

    this.pools = this.poolsByChain.map((pool: any) => {
      return {
        chainId: pool.chainId,
        address: pool.address,
        scope: pool.scope as Hash,
        deploymentBlock: pool.deploymentBlock
      }
    })

    this.chainData = { ...chainData }

    this.emitUpdate()
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

      const pool = this.poolsByChain.find((p: any) => p.chainId === 11155111)
      if (!pool) {
        throw new Error('Pool not found')
      }

      this.selectedPool = { ...pool, scope: pool.scope as Hash }
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
    this.selectedPool = null
    this.selectedPoolAccount = null
  }

  toJSON() {
    return {
      ...this,
      ...super.toJSON()
    }
  }
}
