import {Injectable} from '@nestjs/common'
import _ from 'lodash';
import {TxHistories} from 'src/databases/entities/tx_histories.entity'
import {TRANSACTION_TYPE, WITHDRAW_STATUS} from 'src/withdraw/constants'

import {CreateTxHistoryDto} from '../tx-history/dto/tx-history.dto'
import {ACTION_INSERT_TYPE_DTO} from "./constant";
import {GetTxHistoryDto} from './dto/get-tx-history'
import {TxHistoryRepository} from './tx-history.repository'

@Injectable()
export class TxHistorySevice {
  constructor(
    private readonly txHistoryRepository: TxHistoryRepository
  ) {
  }

  async insertIntoTxHistory(createTxHistoryDto: CreateTxHistoryDto) {
    try {
      const {userId, symbol, tokenAddress, amount, tokenId, contractAddress, tx} = createTxHistoryDto
      const txHistory = new TxHistories
      txHistory.userId = userId;
      txHistory.symbol = symbol;
      txHistory.tokenAddress = tokenAddress;
      txHistory.amount = amount;
      txHistory.tokenId = tokenId;
      txHistory.contractAddress = contractAddress;
      txHistory.tx = tx;
      txHistory.type = TRANSACTION_TYPE.DEPOSIT_TOKEN;
      txHistory.status = WITHDRAW_STATUS.PENDING;
      return await txHistory.save();
    } catch (error) {
      console.log(error);
    }
  }

  addHistory(dto: ACTION_INSERT_TYPE_DTO): Promise<TxHistories> {
    const {userId, symbol, amount, type, tx} = dto
    return this.txHistoryRepository.save({
      ...dto,
      type: _.lowerCase(type),
      userId,
      symbol,
      amount: String(amount),
      status: WITHDRAW_STATUS.SUCCESS,
      tx: tx ?? '0x0000000000000000000000000000000000000000'
    })
  }

  async getPendingTxHistory(userId: number, getTxHistoryDto: GetTxHistoryDto) {
    const {limit, page} = getTxHistoryDto
    const query = await this.txHistoryRepository
      .createQueryBuilder('tx')
      .leftJoinAndSelect('users', 'user', 'user.id = tx.user_id')
      .where('tx.user_id = :userId', {userId})
      .andWhere('tx.status = :status', {status: WITHDRAW_STATUS.PENDING})
      .limit(limit)
      .offset(limit * (page - 1));

    const [list, count] = await Promise.all(
      [
        query.getMany(),
        query.getCount()
      ]
    );
    return {list, count}
  }

  async getTxHistory(userId: number, getTxHistoryDto: GetTxHistoryDto) {
    const {limit, page} = getTxHistoryDto
    const query = await this.txHistoryRepository
      .createQueryBuilder('tx')
      .leftJoinAndSelect('users', 'user', 'user.id = tx.user_id')
      .where('tx.user_id = :userId', {userId})
      .andWhere('tx.status = :status', {status: WITHDRAW_STATUS.SUCCESS})
      .limit(limit)
      .offset(limit * (page - 1));

    const [list, count] = await Promise.all(
      [
        query.getMany(),
        query.getCount()
      ]
    );
    return {list, count}
  }
}
