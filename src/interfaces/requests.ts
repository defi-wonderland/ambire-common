import { ActionExecutionType } from '../controllers/actions/types'
import { TokenResult } from '../libs/portfolio'
import { ControllerInterface } from './controller'
import { DappProviderRequest } from './dapp'
import { SwapAndBridgeActiveRoute } from './swapAndBridge'

export type IRequestsController = ControllerInterface<
  InstanceType<typeof import('../controllers/requests/requests').RequestsController>
>

export type BuildRequest =
  | {
      type: 'dappRequest'
      params: {
        request: DappProviderRequest
        dappPromise: {
          session: DappProviderRequest['session']
          resolve: (data: any) => void
          reject: (data: any) => void
        }
      }
    }
  | {
      type: 'transferRequest'
      params: {
        amount: string
        recipientAddress: string
        selectedToken: TokenResult
        actionExecutionType: ActionExecutionType
        windowId?: number
      }
    }
  | {
      type: 'swapAndBridgeRequest'
      params: {
        openActionWindow: boolean
        activeRouteId?: SwapAndBridgeActiveRoute['activeRouteId']
        windowId?: number
      }
    }
  | {
      type: 'claimWalletRequest' | 'mintVestingRequest'
      params: {
        token: TokenResult
        windowId?: number
      }
    }
  | {
      type: 'intentRequest'
      params: {
        amount: string
        recipientAddress: string
        selectedToken: TokenResult
        actionExecutionType: ActionExecutionType
      }
    }
  | {
      type: 'privateDepositRequest'
      params: {
        actionExecutionType: ActionExecutionType
        txList: { to: string; value: bigint; data: string }[]
      }
    }
  | {
      type: 'privateSendRequest'
      params: {
        actionExecutionType: ActionExecutionType
        windowId?: number

        // temporary random values
        amount: string
        recipientAddress: string
        selectedToken: TokenResult
      }
    }
  | {
      type: 'privateRagequitRequest'
      params: {
        actionExecutionType: ActionExecutionType
        windowId?: number

        // temporary random values
        amount: string
        recipientAddress: string
        selectedToken: TokenResult
      }
    }
