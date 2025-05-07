import EventEmitter from '../../eventEmitter/eventEmitter'
import { TransactionDependencies } from '../dependencies'
import { TransactionFormState } from '../transactionFormState'

export class TransferController extends EventEmitter {
  constructor(
    private readonly dependencies: TransactionDependencies,
    private readonly formState: TransactionFormState
  ) {
    super()
  }

  get isFormEmpty() {
    // only field for a Transfer transaction
    return !this.formState.fromChainId || !this.formState.toChainId
  }

  // doSomething() {
  //   Access dependencies like this
  //   this.dependencies.networks
  // }
}
