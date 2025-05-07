import { SwapController } from './controllers/swap'
import { BridgeController } from './controllers/bridge'
import { TransferController } from './controllers/transfer'
import { TransactionFormState } from './transactionFormState'
import { TransactionDependencies } from './dependencies'

export class TransactionManager {
  public swap: SwapController

  public bridge: BridgeController

  public transfer: TransferController

  public formState: TransactionFormState

  constructor(dependencies: TransactionDependencies) {
    // if we need to access dependencies in the future
    // just pass it down to the transaction form state
    this.formState = new TransactionFormState()

    this.swap = new SwapController(dependencies, this.formState)
    this.bridge = new BridgeController(dependencies, this.formState)
    this.transfer = new TransferController(dependencies, this.formState)
  }
}
