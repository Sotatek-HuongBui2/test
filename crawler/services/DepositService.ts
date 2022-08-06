import BigNumber from "bignumber.js";

import { convertWeiToEther } from "../../src/common/Web3";
import { WITHDRAW_STATUS } from "../../src/withdraw/constants";
import { MAX_AMOUNT, TRANSACTION_TYPE } from "../constants/enum";
import { Nfts } from "../entities/Nft.entity";
import { NftAttributes } from "../entities/NftAttributes.entity";
import { SpendingBalances } from "../entities/SpendingBalance.entity";
import { TxHistories } from "../entities/TxHistories.entity";

export class DepositService {

  public async depositToken(event) {
    const params = event.returnValues
    const userBalance = await this.getTokenBalanceOfUser(params.userId, params.token.toLowerCase())
    if (!userBalance) return
    const amountBignumber = await convertWeiToEther(params.amount)
    userBalance.amount = new BigNumber(userBalance.amount).plus(amountBignumber).toString()
    userBalance.availableAmount = new BigNumber(userBalance.availableAmount).plus(amountBignumber).toString()
    userBalance.maxAmount = new BigNumber(userBalance.availableAmount).plus(amountBignumber).toString()
    const maxAmountDeposit = new BigNumber(userBalance.maxAmount)
    // if (maxAmountDeposit.isGreaterThanOrEqualTo(MAX_AMOUNT)) return
    await userBalance.save()
    await this.insertTxHistories(params, event.transactionHash, amountBignumber)
  }

  public async depositNft(event) {
    const params = event.returnValues
    const nft = await this.getNftById(params.collection.toLowerCase(), params.tokenId)
    if (!nft) return
    nft.owner = params.user
    await nft.save()
    await Nfts.update({ id: nft.nftId }, { isLock: 0 })
    await this.updateTxHistories(event.transactionHash)
  }

  private async updateTxHistories(tx) {
    const findTxHistory = await TxHistories.findOne({
      where: {
        tx,
        status: WITHDRAW_STATUS.PENDING,
      }
    })
    if (!findTxHistory) return
    findTxHistory.status = WITHDRAW_STATUS.SUCCESS
    await findTxHistory.save()
  }

  private async getTokenBalanceOfUser(userId: string, token: string) {
    return SpendingBalances.findOne({ where: { userId, tokenAddress: token } })
  }

  private async getNftById(contractAddress: string, tokenId: string) {
    return NftAttributes.findOne({ where: { contractAddress, tokenId } })
  }

  private async insertTxHistories(params, tx, amount) {
    const txHistories = new TxHistories();
    txHistories.userId = params.userId
    txHistories.tokenAddress = params.token;
    txHistories.amount = amount
    txHistories.type = TRANSACTION_TYPE.DEPOSIT_TOKEN
    txHistories.tx = tx
    txHistories.status = 'success'
    return await txHistories.save()
  }
}

export default new DepositService()
