import EventEmitter from '../../eventEmitter/eventEmitter'
import { SignAccountOpController } from '../../signAccountOp/signAccountOp'
import { TokenResult } from '../../../libs/portfolio'
import { ControllersTransactionDependecies } from '../dependencies'
import { TransactionFormState } from '../transactionFormState'
import { randomId } from '../../../libs/humanizer/utils'
import { getBaseAccount } from '../../../libs/account/getBaseAccount'
import { batchCallsFromUserRequests } from '../../../libs/main/main'
import { getAmbirePaymasterService } from '../../../libs/erc7677/erc7677'

export class IntentController extends EventEmitter {
  public formPreviousState: any

  public publicClient: any | undefined = undefined

  public params: any = {}

  public quote: any = null

  public transactions = []

  private signAccountOpController: SignAccountOpController | null = null

  constructor(
    private readonly dependencies: ControllersTransactionDependecies,
    private readonly formState: TransactionFormState
  ) {
    super()
  }

  public async getProtocolQuote() {
    const currentState = this.formState.state

    // sender: '0x80B7064b28cD538FaD771465984aa799d87A1187',
    // recipient: '0x0000000000000000000000000000000000000000',
    // inputAmount: '10000',
    // inputTokenAddress: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
    // outputTokenAddress: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
    // inputChainId: 11155111,
    // outputChainId: 84532

    // if (this.shouldRefetchQuotes(currentState)) {
    try {
      const input = {
        inputTokenAddress: currentState.fromSelectedToken?.address,
        outputTokenAddress: currentState.toSelectedToken?.address,
        inputChainId: currentState.fromChainId,
        outputChainId: currentState.toChainId,
        inputAmount: currentState.fromAmount,
        recipient:
          currentState.addressState.ensAddress ||
          currentState.addressState.interopAddress ||
          currentState.addressState.fieldValue,
        sender: this.dependencies.selectedAccount.account?.addr
      }

      this.params = input

      // const options = {
      //   protocol: 'across'
      // }
      //
      // const rawQuote = (await this.getQuotes(input, options)) as any
      //
      // const finalQuote = {
      //   fromAsset: this.formState.portfolioTokenList
      //     .filter((token: TokenResult) => token.chainId === rawQuote.inputChainId)
      //     .find((token: TokenResult) => token.address === rawQuote.inputToken),
      //   fromChainId: rawQuote.inputChainId,
      //   toAsset: this.formState.portfolioTokenList
      //     .filter((token: TokenResult) => token.chainId === rawQuote.outputChainId)
      //     .find((token: TokenResult) => token.address === rawQuote.outputToken),
      //   toChainId: rawQuote.outputChainId,
      //   selectedRouteSteps: [],
      //   routes: [],
      //   selectedRoute: {
      //     toAmount: rawQuote.inputAmount || '0'
      //   }
      // } as unknown as SwapAndBridgeQuote
      //
      // this.formState.quote = finalQuote
      await this.initSignAccountOpIfNeeded()
      this.emitUpdate()
    } catch (error: any) {
      this.emitError({ error, level: 'silent', message: error?.message })
    }
    // }
  }

  // If we want to track specific changes, uncomment this
  // private shouldRefetchQuotes(state: any): boolean {
  // const relevantFields = ['fromChainId', 'fromSelectedToken', 'toChainId', 'toSelectedToken']
  //
  // if (!this.formPreviousState) {
  //   this.formPreviousState = state
  //   return true
  // }
  //
  // const hasRelevantChanges = relevantFields.some(
  //   (field) => state[field] !== this.formPreviousState[field]
  // )
  // this.formPreviousState = { ...state }
  //
  // return hasRelevantChanges
  // }

  // eslint-disable-next-line class-methods-use-this
  // public async getQuotes(inputs: any, options?: any) {
  //   // await this.dependencies.interopSDK.getQuotes()
  //   return new Promise((resolve) => {
  //     setTimeout(() => {
  //       resolve({
  //         inputToken: '0x0b2c639c533813f4aa9d7837caf62653d097ff85', // USDC in Optimism
  //         outputToken: '0xaf88d065e77c8cc2239327c5edb3a432268e5831', // USDC in Arbitrum
  //         inputChainId: '10',
  //         outputChainId: '42161',
  //         inputAmount: '100',
  //         outputAmount: '98',
  //         fee: '2',
  //         oifParams: {
  //           fillDeadline: 152452345,
  //           orderDataType: 324234234234,
  //           orderData: [234, 24, 24, 52]
  //         }
  //       })
  //     }, 500)
  //   })
  // }

  public setQuote(quote: any) {
    this.quote = quote
    this.emitUpdate()
  }

  public setTransaction(transactions: any) {
    this.transactions = transactions
    this.emitUpdate()
  }

  public setQuoteAndTransaction(quote: any, transactions: any) {
    this.quote = quote
    this.transactions = transactions
    this.emitUpdate()
  }

  public getSignAccountOpController(): SignAccountOpController | null {
    return this.signAccountOpController
  }

  public destroySignAccountOp() {
    if (!this.signAccountOpController) return
    this.signAccountOpController.reset()
    this.signAccountOpController = null
    this.formState.hasProceeded = false
  }

  public async initSignAccountOpIfNeeded() {
    // no updates if the user has commited
    if (this.formState.hasProceeded === true) return

    // shouldn't happen ever
    if (!this.dependencies.selectedAccount.account) return

    // again it shouldn't happen but there might be a case where the from token
    // disappears because of a strange update event. It's fine to just not
    // continue from the point forward
    if (
      !this.formState.fromSelectedToken ||
      !this.formState.toSelectedToken ||
      !this.formState.toChainId
    ) {
      return
    }

    const fromToken = this.formState.fromSelectedToken as TokenResult
    const network = this.dependencies.networks.networks.find(
      (net) => net.chainId === fromToken.chainId
    )

    // shouldn't happen ever
    if (!network) return

    const provider = this.dependencies.providers.providers[network.chainId.toString()]
    const accountState = await this.dependencies.accounts.getOrFetchAccountOnChainState(
      this.dependencies.selectedAccount.account.addr,
      network.chainId
    )

    // learn the token in the portfolio
    this.dependencies.portfolio.addTokensToBeLearned(
      [this.formState.toSelectedToken.address],
      BigInt(this.formState.toChainId)
    )

    // check if we have an accountOp in main
    const userRequestCalls = batchCallsFromUserRequests({
      accountAddr: this.dependencies.selectedAccount.account.addr,
      chainId: network.chainId,
      userRequests: this.dependencies.userRequests
    })

    if (this.signAccountOpController) {
      this.signAccountOpController.update({ calls: userRequestCalls })
      return
    }

    const baseAcc = getBaseAccount(
      this.dependencies.selectedAccount.account,
      accountState,
      this.dependencies.keystore.getAccountKeys(this.dependencies.selectedAccount.account),
      network
    )

    const accountOp = {
      accountAddr: this.dependencies.selectedAccount.account.addr,
      chainId: network.chainId,
      signingKeyAddr: null,
      signingKeyType: null,
      gasLimit: null,
      gasFeePayment: null,
      nonce: accountState.nonce,
      signature: null,
      accountOpToExecuteBefore: null,
      calls: userRequestCalls,
      flags: {
        hideActivityBanner:
          this.formState.fromSelectedToken.chainId !==
          BigInt(this.formState.toSelectedToken.chainId)
      },
      meta: {
        paymasterService: getAmbirePaymasterService(baseAcc, this.dependencies.relayerUrl)
      }
    }

    this.signAccountOpController = new SignAccountOpController(
      this.dependencies.accounts,
      this.dependencies.networks,
      this.dependencies.keystore,
      this.dependencies.portfolio,
      this.dependencies.externalSignerControllers,
      this.dependencies.selectedAccount.account,
      network,
      provider,
      randomId(), // the account op and the action are fabricated
      accountOp,
      () => {
        return true
      },
      false,
      undefined
    )

    this.emitUpdate()

    // propagate updates from signAccountOp here
    this.signAccountOpController.onUpdate(() => {
      this.emitUpdate()
    })

    this.signAccountOpController.onError((error) => {
      this.dependencies.portfolio.overridePendingResults(this.signAccountOpController!.accountOp)
      this.emitError(error)
    })
  }
}
