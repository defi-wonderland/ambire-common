import EventEmitter from '../../eventEmitter/eventEmitter'
import { TransactionDependencies } from '../dependencies'
import { TransactionFormState } from '../transactionFormState'

export class SwapController extends EventEmitter {
  constructor(
    private readonly dependencies: TransactionDependencies,
    private readonly formState: TransactionFormState
  ) {
    super()
  }

  get isFormEmpty() {
    // only field for a Swap transaction
    return (
      !this.formState.fromChainId ||
      !this.formState.toChainId ||
      !this.formState.fromAmount ||
      !this.formState.toAmount
    )
  }

  // doSomething() {
  //   Access dependencies like this
  //   this.dependencies.networks
  // }
}
