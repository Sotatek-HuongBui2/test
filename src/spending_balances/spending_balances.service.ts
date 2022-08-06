import {BadRequestException, Injectable} from '@nestjs/common'
import {BigNumber} from 'bignumber.js'
import {EntityManager} from 'typeorm'
import {QueryRunner} from "typeorm/query-runner/QueryRunner";

import {SpendingBalances} from "../databases/entities/spending_balances.entity";
import {SpendingBalancesRepository} from './spending_balances.repository'

@Injectable()
export class SpendingBalancesSevice {
  constructor(
    private readonly spendingBalancesRepository: SpendingBalancesRepository,
  ) {
  }

  async balanceAmount(buyerId: number, sellerId: number, priceNft: string, transactionsFee: string, manager: EntityManager) {
    const buyerSpending = await manager.getRepository(SpendingBalances)
      .createQueryBuilder('sb')
      .setLock("pessimistic_write")
      .where('sb.userId = :buyerId', {buyerId})
      .andWhere('sb.tokenAddress = :tokenAddress', {tokenAddress: process.env.AVAX_ADDRESS})
      .getOne();

    const sellerSpending = await manager.getRepository(SpendingBalances)
      .createQueryBuilder('sb')
      .setLock("pessimistic_write")
      .where('sb.userId = :sellerId', {sellerId})
      .andWhere('sb.tokenAddress = :tokenAddress', {tokenAddress: process.env.AVAX_ADDRESS})
      .getOne();

    if (!buyerSpending || !sellerSpending) throw new BadRequestException(`You don't have a wallet account yet!`);
    const buyerAmount = new BigNumber(buyerSpending.amount);
    const buyerAvailableAmount = new BigNumber(buyerSpending.availableAmount);
    const sellerAvailableAmount = new BigNumber(sellerSpending.availableAmount);
    const nftPrice = new BigNumber(priceNft);
    const totalFee = new BigNumber(priceNft).div(100).times(transactionsFee).toString()
    if (nftPrice.isGreaterThan(buyerAvailableAmount)) throw new BadRequestException('Not enough to buy')

    const buyerBalancesAmount = buyerAmount.minus(nftPrice);
    const buyerBalancesAmountAvailable = buyerAvailableAmount.minus(nftPrice);
    const sellerBalances = sellerAvailableAmount.plus(priceNft).minus(totalFee)

    await manager.update(SpendingBalances, {walletId: buyerSpending.walletId}, {
      availableAmount: buyerBalancesAmountAvailable.toString(),
      amount: buyerBalancesAmount.toString(),
    })

    await manager.update(SpendingBalances, {walletId: sellerSpending.walletId}, {
      amount: sellerBalances.toString(),
      availableAmount: sellerBalances.toString()
    })
  }

  async updateBalanceWithTxManager(
    amount: string,
    symbol: string,
    userId: number,
    queryRunner: QueryRunner
  ) {
    const spendingBalances = await queryRunner
      .manager
      .getRepository(SpendingBalances)
      .createQueryBuilder('sb')
      .setLock("pessimistic_write")
      .where('sb.symbol = :symbol AND sb.userId = :userId', {
        symbol,
        userId
      })
      .getOne();
    if (!spendingBalances) throw new BadRequestException('Spending Balances not found')
    spendingBalances.amount = new BigNumber(amount)
      .plus(spendingBalances.amount)
      .toString()
    spendingBalances.availableAmount = new BigNumber(amount)
      .plus(spendingBalances.availableAmount)
      .toString()
    return queryRunner
      .manager
      .getRepository(SpendingBalances)
      .update({
          symbol,
          userId
        },
        {
          amount: spendingBalances.amount,
          availableAmount: spendingBalances.availableAmount
        }
      )
  }

  async plusAmoutSpending(amount: string, symbol, userId) {
    const spendingBalances = await SpendingBalances.findOne({symbol, userId})
    if (!spendingBalances) throw new BadRequestException('Spending Balances not found')
    spendingBalances.amount = new BigNumber(spendingBalances.amount).plus(amount).toString()
    spendingBalances.availableAmount = new BigNumber(spendingBalances.availableAmount).plus(amount).toString()
    await spendingBalances.save()
    return spendingBalances
  }
}
