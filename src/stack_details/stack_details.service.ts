import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import BigNumber from "bignumber.js";
import {IsNumber,isNumber} from "class-validator";
import { getEarningToken, getLevelUpDiscount, getMintingDiscount, minusTokenSpendingBalances } from 'src/common/Utils';
import { abi } from "src/common/Utils";
import { getSlftPrice } from 'src/common/Utils';
import { StackCampaigns } from 'src/databases/entities/stack_campaigns.entity';
import { StackDetails } from 'src/databases/entities/stack_details.entity';
import { Stakes } from 'src/databases/entities/stakes.entity';
import { User } from 'src/databases/entities/user.entity';
import { SpendingBalancesSevice } from 'src/spending_balances/spending_balances.service';
import { Connection, TreeLevelColumn } from 'typeorm';
import { Repository } from 'typeorm';

import Redis from "../common/Redis";
import { UserStakeEntity } from "../databases/entities/user_stake.entity";
import { AddStakingInput } from './dtos/add-staking.dto';
import {
  DATE_NOW,
  IsLock,
  KEY_IN_CACHE,
  LOCK_TIME,
  NUMBER_DAY_IN_MONTH,
  NUMBER_DAY_IN_YEAR,
  ONE_DAY,
  PERCENT_BEFORE_LOCK_TIME,
  StatusStacking,
  TOKEN_SYMBOL
} from './enum';


@Injectable()
export class StackDetailsService {
  constructor(
    @InjectRepository(StackDetails)
    private stackDetailsRepository: Repository<StackDetails>,
    @InjectRepository(UserStakeEntity)
    private stakesRepository: Repository<UserStakeEntity>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Stakes)
    private stakeRepository: Repository<Stakes>,
    private spendingBalancesService: SpendingBalancesSevice,
    private connection: Connection
  ) {
  }

  async addStaking(user: User, payload: AddStakingInput) {
    try {
      const userFind = await User.findOne({ id: user.id });
      if (userFind.wallet.toLowerCase() != process.env.ADMIN_MAIN_WALLET.toLowerCase()) {
        throw new Error('Unauthorized');
      }
      const { totalStakeAllocation } = payload;
      const curentTime = new Date();
      const endTimeCampaign = curentTime.setDate(curentTime.getDate() + 30).toString();
      const stake = await this.insertStaking("", totalStakeAllocation, totalStakeAllocation, endTimeCampaign);
      return await stake.save();
    }
    catch (error) {
      throw new BadRequestException(error);
    }
  }

  async insertStaking(tvl: string, availableTotalStake: string, totalStakeAllocation: string, endTimeCampaign: string) {
    const checkStake = await Stakes.findOne();
    if (checkStake) {
      throw new Error('Stake already exists');
    }
    const stake = new Stakes();
    stake.tvl = tvl;
    stake.availableTotalStake = availableTotalStake;
    stake.totalStakeAllocation = totalStakeAllocation;
    stake.endTimeCampaign = endTimeCampaign;

    return stake;
  }

  async stacking(amount: string, user: User) {
    if (!amount) {
      throw new BadRequestException('Invalid quantity');
    }
    if (amount == '0') {
      throw new BadRequestException('Amount input can not be zero');
    }
    // Create Transaction
    const queryRunner = this.connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      await minusTokenSpendingBalances(user.id, TOKEN_SYMBOL, amount);
      const stackCampaigns = await this.insertStackCampaigns();
      await queryRunner.manager.save(stackCampaigns);

      const stackDetails = await this.insertStackDetails(amount, stackCampaigns, user.id);
      await queryRunner.manager.save(stackDetails);

      await this.plusTotalStaking(amount, queryRunner);

      if (stackDetails) {
        const checkStake = await UserStakeEntity.findOne({ userId: user.id });
        const totalStake = checkStake ? new BigNumber(checkStake.totalStake).plus(amount).toString() : amount;
        const updateStakeUser = await this.updateStakeUser(totalStake, '0', user.id);
        await queryRunner.manager.save(updateStakeUser);
      }
      await queryRunner.commitTransaction();
      return { stackCampaigns, stackDetails };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw new BadRequestException(error);
    } finally {
      queryRunner.release();
    }
  }

  async updateStakeUser(totalStake: string, totalReward: string, userId: number) {
    let userStake = await UserStakeEntity.findOne({ userId });
    if (!userStake) {
      userStake = new UserStakeEntity();
    }
    userStake.userId = userId;
    userStake.totalStake = totalStake;
    userStake.totalReward = totalReward
    userStake.earningToken = await getEarningToken(parseInt(totalStake))
    userStake.mintingDiscount = await getMintingDiscount(parseInt(totalStake))
    userStake.levelUpDiscount = await getLevelUpDiscount(parseInt(totalStake))
    return userStake;
  }

  async plusTotalStaking(amount: string, queryRunner: any) {
    const staking = await Stakes.findOne()

    if (!staking) {
      const stake = new Stakes()
      stake.tvl = new BigNumber(amount).toString();
      stake.availableTotalStake = process.env.TOTAL_STAKE_ALLOCATION.toString()
      stake.totalStakeAllocation = process.env.TOTAL_STAKE_ALLOCATION.toString()
      await queryRunner.manager.save(stake);
    } else {
      staking.tvl = new BigNumber(staking.tvl).plus(amount).toString()
      await queryRunner.manager.save(staking);
    }
  }

  async minusTotalStaking(amount: string) {
    const staking = await Stakes.findOne()
    if (new BigNumber(staking.tvl).comparedTo(new BigNumber(amount)) == -1) {
      throw new BadRequestException('Staking tvl less than 0')
    }
    staking.tvl = new BigNumber(staking.tvl).minus(amount).toString();
    return staking;
  }

  async insertStackCampaigns() {
    const stackCampaigns = new StackCampaigns();
    stackCampaigns.stakeToken = TOKEN_SYMBOL
    stackCampaigns.rewardToken = TOKEN_SYMBOL
    return stackCampaigns;
  }

  async insertStackDetails(
    amount: string,
    stackCampaigns: StackCampaigns,
    userId: number,
  ) {
    const millisecondsTime = new Date(stackCampaigns.createdAt).getTime();
    const stackDetails = new StackDetails();
    stackDetails.userId = userId;
    stackDetails.stackCampaignId = stackCampaigns.id;
    stackDetails.stakeToken = TOKEN_SYMBOL;
    stackDetails.amount = amount
    stackDetails.isLock = IsLock.TRUE;
    stackDetails.reward = '0';
    stackDetails.statusStacking = StatusStacking.STAKE;
    stackDetails.startTime = millisecondsTime.toString();
    stackDetails.rewardTime = millisecondsTime.toString();
    stackDetails.lockTime = (millisecondsTime + LOCK_TIME).toString();
    return stackDetails;
  }

  async unStacking(user: User) {
    const tokenStakes = await this.findTokenStakes(user.id);
    if (tokenStakes.length == 0) throw new BadRequestException('You are not staking');
    let totalReward = '0';
    let totalAmount = '0'

    // Create Transaction
    const queryRunner = this.connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const tokenStakesUpdate = tokenStakes.map((token) => {
        totalReward = new BigNumber(totalReward).plus(token.reward).toString()
        totalAmount = new BigNumber(totalAmount).plus(token.amount).toString()
        return {
          ...token,
          statusStacking: StatusStacking.UNSTAKE,
        };
      });
      const updateStake = await this.minusTotalStaking(totalAmount);
      await queryRunner.manager.save(updateStake);
      await queryRunner.manager.getRepository(StackDetails).save(tokenStakesUpdate);
      const updateStakeUser = await this.updateStakeUser('0', '0', user.id);
      await queryRunner.manager.save(updateStakeUser);
      let total = new BigNumber(totalAmount).plus(new BigNumber(totalReward)).toString()
      if (!await this.checkLockTime(tokenStakes)) {
        const fistStakeAmount = new BigNumber(tokenStakes[0].amount).times(PERCENT_BEFORE_LOCK_TIME).toString()
        total = new BigNumber(totalAmount).minus(fistStakeAmount).toString()
      }

      await queryRunner.commitTransaction();
      return await this.spendingBalancesService.plusAmoutSpending(total, TOKEN_SYMBOL, user.id);
    }
    catch (error) {
      await queryRunner.rollbackTransaction();
      throw new BadRequestException(error);
    } finally {
      queryRunner.release();
    }
  }

  async findTokenStakes(userId) {
    const tokenStakes = await this.stackDetailsRepository
      .createQueryBuilder('stackDetail')
      .select([
        'stackDetail.id as id',
        'stackDetail.amount as amount',
        'stackDetail.reward as reward',
        'stackDetail.lock_time as lockTime',
        'stackDetail.status_stacking as statusStacking',
      ])
      .where(
        'stackDetail.status_stacking = :status AND stackDetail.user_id = :userId AND stackDetail.stake_token = :symbol',
        { status: StatusStacking.STAKE, userId: userId, symbol: TOKEN_SYMBOL },
      )
      .orderBy('stackDetail.created_at', "ASC")
      .getRawMany();
    return tokenStakes;
  }

  async getInfo(userId: number) {
    const userStake = await UserStakeEntity.findOne({ userId })
    const stakes = await Stakes.findOne()
    const noStake = {
      "total_stake": "0",
      "total_reward": "0",
      "earning_token": "0",
      "minting_discount": "0",
      "level_up_discount": "0",
      "symbol": null,
      "user_id": userId,
    }
    const listStackDetails = await this.stackDetailsRepository.find({
      where: {
        userId: userId,
        statusStacking: StatusStacking.STAKE
      },
      order: { createdAt: 'ASC' }
    })
    let isCompound = false
    if (listStackDetails.length > 0) {
      isCompound = await this.checkLockTime(listStackDetails)
    }
    const totalStake = await Stakes.findOne()
    const tvl = totalStake ? totalStake.tvl : '0'
    const stake = userStake ? userStake : noStake
    const apr = await this.getApr(stakes.totalStakeAllocation, stakes.tvl)
    const aprInDay = await this.getAprInDay(stakes.totalStakeAllocation, stakes.tvl)
    const slftPriceUsd = await this.getSlftPriceFromUtils()
    return { stake, isCompound, tvl, apr, aprInDay, slftPriceUsd }
  }

  async getSlftPriceFromUtils() {
    return await getSlftPrice()
  }

  async compound(userId: number) {
    const listStackDetails = await this.stackDetailsRepository.find({
      where: {
        userId: userId,
        statusStacking: StatusStacking.STAKE
      },
      order: { createdAt: 'ASC' }
    }
    )
    if (listStackDetails.length == 0) throw new BadRequestException('You are not staking');

    if (await this.checkLockTime(listStackDetails)) {
      const combineStackDetail = await this.combineStackDetail(listStackDetails, userId)
      return combineStackDetail
    } else {
      throw new BadRequestException('You are not eligible!');
    }

  }

  async checkLockTime(listStackDetails) {
    console.log('======================================')
    console.log(listStackDetails)
    console.log(parseInt(listStackDetails[0].lockTime))
    return (parseInt(listStackDetails[0].lockTime) < (DATE_NOW))
  }

  async combineStackDetail(listStackDetails, userId): Promise<StackDetails> {
    let total = '0';
    let totalReward = '0'
    let reward = '0'
    const combineStackDetail = listStackDetails.map((stackDetail) => {
      total = new BigNumber(total).plus(stackDetail.amount).plus(stackDetail.reward).toString()
      totalReward = new BigNumber(totalReward).plus(stackDetail.reward).toString()
      reward = new BigNumber(stackDetail.reward).toString()
      return {
        ...stackDetail,
        statusStacking: StatusStacking.UNSTAKE
      }
    })
    // Create Transaction
    const queryRunner = this.connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      await this.stackDetailsRepository.save(combineStackDetail)
      const StackCampaigns = await this.insertStackCampaigns()
      await queryRunner.manager.save(StackCampaigns);
      const stackDetails = await this.insertStackDetails(total, StackCampaigns, userId)
      await queryRunner.manager.save(stackDetails);
      const updateStakeUser = await this.updateStakeUser(total, '0', userId)
      await queryRunner.manager.save(updateStakeUser)
      await this.plusTotalStaking(totalReward, queryRunner)
      await queryRunner.commitTransaction();
      return stackDetails;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw new BadRequestException('Error ' + error);
    } finally {
      await queryRunner.release();
    }
  }

  public async getApr(totalReward, totalStake) {
    let apr = await Redis.getInstance().getDataFromCache(KEY_IN_CACHE.APR)
    if (!apr) {
      apr = await this.calApr(totalReward, totalStake)
      if (apr == 'Infinity') {
        apr = '0'
      }
    }
    return apr
  }

  public async getAprInDay(totalReward, totalStake) {
    let apr = await Redis.getInstance().getDataFromCache(KEY_IN_CACHE.APR_IN_DAY)
    if (!apr) {
      apr = await this.calAprInDay(totalReward, totalStake)
      await Redis.getInstance().setDataToCache(KEY_IN_CACHE.APR_IN_DAY, apr)
    }
    return isNumber(Number(apr)) ? apr : '0'
  }

  async calApr(totalReward, totalStake) {
    const totalRewardMonth = new BigNumber(totalStake).times(NUMBER_DAY_IN_MONTH)
    return (new BigNumber(totalReward).div(totalRewardMonth)).times(NUMBER_DAY_IN_YEAR).times(100).toString()
  }

  async calAprInDay(totalReward, totalStake) {
    const totalStakeInMonth = new BigNumber(totalStake).times(NUMBER_DAY_IN_MONTH).toString()
    return new BigNumber(totalReward).div(totalStakeInMonth).toString()
  }

}
