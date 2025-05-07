// This class should only contain the state of the form to be used
// in the only page of the transaction flow
export class TransactionFormState {
  fromAmount: string = ''

  fromAmountInFiat: string = ''

  fromAmountFieldMode: 'fiat' | 'token' = 'token'

  toAmount: string = ''

  toAmountInFiat: string = ''

  toAmountFieldMode: 'fiat' | 'token' = 'token'

  fromChainId: number | null = null

  toChainId: number | null = null

  update(params: Partial<TransactionFormState>) {
    Object.assign(this, params)
  }

  reset() {
    this.fromAmount = ''
    this.fromAmountInFiat = ''
    this.fromAmountFieldMode = 'token'
    this.toAmount = ''
    this.toAmountInFiat = ''
    this.toAmountFieldMode = 'token'
  }

  get isValid() {
    return this.fromAmount !== '' && this.toAmount !== '' && this.fromChainId && this.toChainId
  }
}
