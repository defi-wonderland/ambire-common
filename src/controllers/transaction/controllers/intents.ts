import EventEmitter from '../../eventEmitter/eventEmitter'
import { TransactionDependencies } from '../dependencies'
import { TransactionFormState } from '../transactionFormState'

export class IntentsController extends EventEmitter {
  constructor(
    private readonly dependencies: TransactionDependencies,
    private readonly formState: TransactionFormState
  ) {
    super()
  }

  get isFormEmpty() {
    // only field for an Intent transaction
    return !this.formState.fromChainId || !this.formState.toChainId || !this.formState.fromAmount
  }

  // doSomething() {
  //   Access dependencies like this
  //   this.dependencies.networks
  // }
}
