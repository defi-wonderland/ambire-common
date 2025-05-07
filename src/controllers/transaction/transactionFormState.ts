// This class should only contain the state of the form to be used
import { AddressState } from 'interfaces/domains'
import { formatUnits, parseUnits } from 'ethers'
import { FromToken, SwapAndBridgeToToken } from 'interfaces/swapAndBridge'
import { TokenResult } from 'libs/portfolio'
import wait from '../../utils/wait'

import { getSanitizedAmount } from '../../libs/transfer/amount'

import { convertTokenPriceToBigInt } from '../../utils/numbers/formatters'
import EventEmitter from '../eventEmitter/eventEmitter'

const HARD_CODED_CURRENCY = 'usd'

const CONVERSION_PRECISION = 16
const CONVERSION_PRECISION_POW = BigInt(10 ** CONVERSION_PRECISION)

const DEFAULT_ADDRESS_STATE = {
  fieldValue: '',
  ensAddress: '',
  isDomainResolving: false
}

// in the only page of the transaction flow
export class TransactionFormState extends EventEmitter {
  fromAmount: string = ''

  fromAmountInFiat: string = ''

  fromAmountFieldMode: 'fiat' | 'token' = 'token'

  toAmount: string = ''

  toAmountInFiat: string = ''

  toAmountFieldMode: 'fiat' | 'token' = 'token'

  fromChainId: number | null = null

  toChainId: number | null = null

  addressState: AddressState = { ...DEFAULT_ADDRESS_STATE }

  isRecipientAddressUnknown = false

  isRecipientAddressUnknownAgreed = false

  isRecipientHumanizerKnownTokenOrSmartContract = false

  fromSelectedToken: FromToken | null = null

  toSelectedToken: SwapAndBridgeToToken | null = null

  routePriority: 'output' | 'time' = 'output'

  #updateToTokenListThrottle: {
    time: number
    throttled: boolean
    shouldReset: boolean
    addressToSelect?: string
  } = {
    time: 0,
    shouldReset: true,
    throttled: false
  }

  async updateForm(props: {
    fromAmount?: string
    fromAmountInFiat?: string
    fromAmountFieldMode?: 'fiat' | 'token'
    fromSelectedToken?: TokenResult | null
    toChainId?: bigint | number
    toSelectedToken?: SwapAndBridgeToToken | null
    routePriority?: 'output' | 'time'
    emitUpdate?: boolean
  }) {
    console.log('updateForm', props)
    const {
      fromAmount,
      fromAmountInFiat,
      fromAmountFieldMode,
      fromSelectedToken,
      toChainId,
      toSelectedToken
    } = props
    let shouldUpdateToTokenList = false

    // fromAmountFieldMode must be set before fromAmount so it
    // works correctly when both are set at the same time
    if (fromAmountFieldMode) {
      this.fromAmountFieldMode = fromAmountFieldMode
    }

    if (fromAmountFieldMode) {
      this.fromAmountFieldMode = fromAmountFieldMode
    }

    if (fromAmount !== undefined) {
      const fromAmountFormatted = fromAmount.indexOf('.') === 0 ? `0${fromAmount}` : fromAmount
      this.fromAmount = fromAmount
      ;(() => {
        if (fromAmount === '') {
          this.fromAmountInFiat = ''
          return
        }
        const tokenPrice = this.fromSelectedToken?.priceIn.find(
          (p) => p.baseCurrency === HARD_CODED_CURRENCY
        )?.price

        if (!tokenPrice) {
          this.fromAmountInFiat = ''
          return
        }

        if (
          this.fromAmountFieldMode === 'fiat' &&
          typeof this.fromSelectedToken?.decimals === 'number'
        ) {
          this.fromAmountInFiat = fromAmount

          // Get the number of decimals
          const amountInFiatDecimals = fromAmount.split('.')[1]?.length || 0
          const { tokenPriceBigInt, tokenPriceDecimals } = convertTokenPriceToBigInt(tokenPrice)

          // Convert the numbers to big int
          const amountInFiatBigInt = parseUnits(fromAmountFormatted, amountInFiatDecimals)

          this.fromAmount = formatUnits(
            (amountInFiatBigInt * CONVERSION_PRECISION_POW) / tokenPriceBigInt,
            // Shift the decimal point by the number of decimals in the token price
            amountInFiatDecimals + CONVERSION_PRECISION - tokenPriceDecimals
          )

          return
        }
        if (this.fromAmountFieldMode === 'token') {
          this.fromAmount = fromAmount

          if (!this.fromSelectedToken) return

          const sanitizedFieldValue = getSanitizedAmount(
            fromAmountFormatted,
            this.fromSelectedToken.decimals
          )
          // Convert the field value to big int
          const formattedAmount = parseUnits(sanitizedFieldValue, this.fromSelectedToken.decimals)

          if (!formattedAmount) return

          const { tokenPriceBigInt, tokenPriceDecimals } = convertTokenPriceToBigInt(tokenPrice)

          this.fromAmountInFiat = formatUnits(
            formattedAmount * tokenPriceBigInt,
            // Shift the decimal point by the number of decimals in the token price
            this.fromSelectedToken.decimals + tokenPriceDecimals
          )
        }
      })()
    }

    if (fromAmountInFiat !== undefined) {
      this.fromAmountInFiat = fromAmountInFiat
    }

    if (fromSelectedToken) {
      const isFromNetworkChanged = this.fromSelectedToken?.chainId !== fromSelectedToken?.chainId

      const shouldResetFromTokenAmount =
        isFromNetworkChanged || this.fromSelectedToken?.address !== fromSelectedToken.address
      if (shouldResetFromTokenAmount) {
        this.fromAmount = ''
        this.fromAmountInFiat = ''
        this.fromAmountFieldMode = 'token'
      }

      // Always update to reflect portfolio amount (or other props) changes
      this.fromSelectedToken = fromSelectedToken
    }

    if (toChainId) {
      if (this.toChainId !== Number(toChainId)) {
        this.toChainId = Number(toChainId)
        shouldUpdateToTokenList = true
      }
    }

    if (typeof toSelectedToken !== 'undefined') {
      this.toSelectedToken = toSelectedToken
    }

    await Promise.all([
      shouldUpdateToTokenList ? this.updateToTokenList(true, toSelectedToken?.address) : undefined
    ])

    this.emitUpdate()
  }

  async updateToTokenList(shouldReset: boolean, addressToSelect?: string) {
    const now = Date.now()
    const timeSinceLastCall = now - this.#updateToTokenListThrottle.time
    if (timeSinceLastCall <= 500) {
      this.#updateToTokenListThrottle.shouldReset = shouldReset
      this.#updateToTokenListThrottle.addressToSelect = addressToSelect

      if (!this.#updateToTokenListThrottle.throttled) {
        this.#updateToTokenListThrottle.throttled = true
        await wait(500 - timeSinceLastCall)
        this.#updateToTokenListThrottle.throttled = false
        await this.updateToTokenList(
          this.#updateToTokenListThrottle.shouldReset,
          this.#updateToTokenListThrottle.addressToSelect
        )
      }
    }
  }

  resetForm() {
    // Preserve key form states instead of resetting the whole form to enhance UX and reduce confusion.
    // After form submission, maintain the state for fromSelectedToken, fromChainId, and toChainId,
    // while resetting all other state related to the form.
    this.fromAmount = ''
    this.fromAmountInFiat = ''
    this.fromAmountFieldMode = 'token'
    this.toSelectedToken = null
  }

  reset() {
    this.fromAmount = ''
    this.fromAmountInFiat = ''
    this.fromAmountFieldMode = 'token'
    this.toAmount = ''
    this.toAmountInFiat = ''
    this.toAmountFieldMode = 'token'

    this.resetForm()
    this.fromChainId = 1
    this.fromSelectedToken = null
    this.toChainId = 1
  }

  get isFormEmpty() {
    return (
      !this.fromChainId ||
      !this.toChainId ||
      !this.fromAmount ||
      !this.toAmount ||
      !this.addressState.fieldValue
    )
  }
}
