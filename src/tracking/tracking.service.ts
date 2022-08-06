import {BadRequestException, Injectable} from '@nestjs/common';
import {ConfigService} from '@nestjs/config';
import {InjectRepository} from '@nestjs/typeorm';
import BigNumber from 'bignumber.js';
import _ from 'lodash';
import moment from 'moment';
import {Connection, getConnection, Repository} from 'typeorm';
import {v4 as uuidv4} from 'uuid';

import {BedInformationRepository} from '../bed-information/repositories/bed-information.repository';
import {CATEGORY_NAME} from '../category/constants';
import {HealthAppData} from '../databases/entities/health-app-data.entity';
import {LuckyBox} from '../databases/entities/lucky_box.entity';
import {NftAttributes} from '../databases/entities/nft_attributes.entity';
import {Nfts} from '../databases/entities/nfts.entity';
import {Tracking} from '../databases/entities/tracking.entity';
import {TrackingResult} from '../databases/entities/tracking-result.entity';
import {User} from '../databases/entities/user.entity';
import {UserEarnTransactions} from '../databases/entities/user_earn_transactions.entity';
import {UserStakeEntity} from '../databases/entities/user_stake.entity';
import {HealthAppDataSevice} from '../health-app-data/health-app-data.service';
import {LARGE_NUMBER_BOX} from '../lucky-box/constants/enum';
import {LuckyBoxSevice} from '../lucky-box/lucky-box.service';
import {ITEM_DATA, JEWELS_DATA} from '../master-data/constants';
import {MasterDataService} from '../master-data/master-data.service';
import {NftAttributesRepository} from '../nft-attributes/nft-attributes.repository';
import {INSURANCE_COST_PERCENT, LOCK_STATUS_NFT, NFT_TYPE,} from '../nfts/constants';
import {NftRepository} from '../nfts/nfts.repository';
import {NftSevice} from '../nfts/nfts.service';
import {KEY_SETTING} from "../settings/constants/key_setting";
import {SettingsService} from '../settings/services/settings.service';
import {RequestContext} from '../shared/request-context/request-context.dto';
import {SpendingBalancesSevice} from '../spending_balances/spending_balances.service';
import {TOKEN_SYMBOL} from '../stack_details/enum';
import {TrackingResultSevice} from "../tracking-result/tracking-result.service";
import {UserRepository} from '../user/repositories/user.repository';
import {
  BED_TIME_COMPARE_AVERAGE,
  BED_TIME_COMPARE_AVERAGE_SCORE,
  BED_TYPE,
  BED_TYPE_TIME,
  BED_TYPE_TIME_SCORE,
  CREATE_LUCKY_BOX,
  DURABILITY_INCREASE_BY_BED_AMOUNT,
  ESTIMATE_TRACKING_RESPONSE,
  HealAppData,
  HEATH_APP_TYPE_DATA,
  MESSAGE_TRACKING,
  PERCENT_LOSE_BED,
  PERCENT_LOSE_JEWEL,
  PLATFORM_TYPE,
  POSITIVE_EFFECT_DATA,
  STATUS_TRACKING,
  TIME_ON_SLEEP_SCORE,
  TIME_ON_SLEEP_TIME_RANGE,
  TOTAL_BED_STATS,
  TRACKING_AMOUNT_BONUS_PERCENT,
  WOKE_UP_AFTER_ALARM,
  WOKE_UP_AFTER_ALARM_SCORE,
  WOKE_UP_BEFORE_ALARM,
  WOKE_UP_BEFORE_ALARM_SCORE,
} from './constants';
import {CreateTrackingDto} from './dtos/create-tracking.dto';
import {EstimateEarnDto} from './dtos/estimate-earn.dto';
import {WakeUpResultDto} from './dtos/wakeup-result.dto';
import {TrackingRepository} from './repositories/tracking.repository';
import {calculateChangeNumber, isInPercent} from './utils';

@Injectable()
export class TrackingService {
  constructor(
    private readonly trackingRepository: TrackingRepository,
    private readonly userRepository: UserRepository,
    private readonly mService: MasterDataService,
    private readonly bedInformationRepository: BedInformationRepository,
    private readonly nftRepository: NftRepository,
    private readonly nftService: NftSevice,
    private readonly nftAttributesRepository: NftAttributesRepository,
    @InjectRepository(UserStakeEntity)
    private userStakeRepository: Repository<UserStakeEntity>,
    @InjectRepository(TrackingResult)
    private trackingResultRepository: Repository<TrackingResult>,
    @InjectRepository(HealthAppData)
    private healthAppDataRepo: Repository<HealthAppData>,
    @InjectRepository(LuckyBox)
    private luckyBoxRepository: Repository<LuckyBox>,
    @InjectRepository(UserEarnTransactions)
    private userEarnTransaction: Repository<UserEarnTransactions>,
    private spendingBalanceService: SpendingBalancesSevice,
    private trackingResultService: TrackingResultSevice,
    private luckyBoxService: LuckyBoxSevice,
    private connection: Connection,
    private readonly configService: ConfigService,
    private readonly healthAppDataSevice: HealthAppDataSevice,
    private readonly settingService: SettingsService,
  ) {
    // setTimeout(async () => {
    //   const sleepScore = await this.wakeUp(
    //     {
    //       datas: [
    //         {
    //           dataType: 'SLEEP_IN_BED',
    //           dateFrom: new Date('2022-07-27 08:20:42'),
    //           dateTo: new Date('2022-07-27 08:31:44'),
    //           platformType: 'ANDROID',
    //           sourceId: '4a4ff1964867ba8e7475b0945501bb1c',
    //           sourceName: 'com.urbandroid.sleep',
    //           unit: 'minutes',
    //           value: '11',
    //         },
    //       ],
    //     },
    //     8,
    //   );
    //   console.log(sleepScore);
    // }, 5000);
  }

  async createTracking(
    createTrackingDto: CreateTrackingDto,
    reqContext: RequestContext,
  ): Promise<any> {
    const isSleeping = await this.trackingRepository.findOne({
      where: {
        userId: reqContext.user.id,
        status: STATUS_TRACKING.SLEEPING,
      },
    });

    if (isSleeping) {
      throw new BadRequestException(MESSAGE_TRACKING.TRACKING_ALREADY_OPEN);
    }
    const user = await this.userRepository.findOne(reqContext.user.id);
    const nftBed = await this.nftService.getAvailableNftBed(
      createTrackingDto.bedUsed,
    );

    if (_.lowerCase(nftBed.attribute?.owner) !== _.lowerCase(user.wallet)) {
      throw new BadRequestException(MESSAGE_TRACKING.INVALID_BED);
    }

    let itemNft = null;
    if (createTrackingDto.itemUsed) {
      itemNft = await this.nftService.getAvailableNft(
        createTrackingDto.itemUsed,
        CATEGORY_NAME.ITEM,
      );
      if (_.lowerCase(itemNft.attribute?.owner) !== _.lowerCase(user.wallet)) {
        throw new BadRequestException(MESSAGE_TRACKING.INVALID_ITEM);
      }
    }

    // if (createTrackingDto.alrm) {
    //   const bedTypeTime = BED_TYPE_TIME[nftBed.attribute.classNft.toUpperCase()];
    //   if (!moment.unix(Number(createTrackingDto.wakeUp))
    //     .isBetween(
    //       moment().add(bedTypeTime.Min, 'hours'),
    //       moment().add(bedTypeTime.Max, 'hours'))
    //   ) {
    //     throw new BadRequestException(
    //       `Wake up time must be in bed range ${moment().add(bedTypeTime.Min, 'hours').format('D-M-YYYY HH:mm:ss')} and ${moment().add(bedTypeTime.Max, 'hours').format('D-M-YYYY HH:mm:ss')}`);
    //   }
    // }

    const nftsJewel = await this.bedInformationRepository.getBedSocket(
      nftBed.id,
    );
    const totalStats = await this.totalBedStats(
      nftBed.attribute,
      nftsJewel,
      itemNft,
    );
    await this.toCheckInsufficientDurability(
      totalStats.resilience,
      nftBed.attribute.durability,
    );
    const itemUsed = itemNft ? itemNft.id : null;
    const estimateEarn = await this.estimateEarnTracking(
      {
        itemUsed,
        bedUsed: nftBed.id,
        isEnableInsurance: createTrackingDto.isEnableInsurance,
      },
      user,
      true,
    );

    let tracking;
    const startSleepTime = moment();
    await getConnection().transaction(async (manager) => {
      tracking = await manager.save(Tracking, {
        ...createTrackingDto,
        hashId: uuidv4(),
        efficiency: totalStats.efficiency,
        insurance:
          INSURANCE_COST_PERCENT[_.lowerCase(nftBed.attribute.quality)],
        luck: totalStats.luck,
        special: totalStats.special,
        bonus: totalStats.bonus,
        resilience: totalStats.resilience,
        enableInsurance: createTrackingDto.isEnableInsurance,
        bedType: nftBed.attribute.classNft,
        bedLevel: nftBed.attribute.level,
        itemLevel: itemNft?.attribute.level,
        status: STATUS_TRACKING.SLEEPING,
        userId: reqContext.user.id,
        startSleep: String(startSleepTime.unix()),
        year: startSleepTime.year(),
        day: startSleepTime.day(),
        month: startSleepTime.month(),
        estEarn: estimateEarn.estimateSlftEarn,
      });
      await manager.update(Nfts, nftBed.id, {isLock: LOCK_STATUS_NFT.LOCK});
      if (itemNft) {
        await manager.update(Nfts, itemNft.id, {
          isLock: LOCK_STATUS_NFT.LOCK,
        });
      }
    });
    return {
      trackingId: tracking.id,
      itemUsed: tracking.itemUsed,
      message: MESSAGE_TRACKING.TRACKING_START_SUCCESS,
    };
  }

  async totalBedStats(
    attributeBed: NftAttributes,
    nftAttributesJewel: NftAttributes[],
    nftItem?: Nfts,
  ): Promise<TOTAL_BED_STATS> {
    const totalPercentIncrease = {
      efficiency: 0,
      luck: 0,
      bonus: 0,
      special: 0,
      resilience: 0,
    };

    nftAttributesJewel.forEach((jewel) => {
      const jewelData = JEWELS_DATA.find((e) => jewel.level === e.level);
      totalPercentIncrease[jewel.type] +=
        jewelData?.percentEffect ||
        JEWELS_DATA[JEWELS_DATA.length - 1].percentEffect;
    });
    const bedStats = {
      efficiency: new BigNumber(attributeBed.efficiency)
        .times(new BigNumber(totalPercentIncrease.efficiency).div(100).plus(1))
        .toFixed(),
      luck: new BigNumber(attributeBed.luck)
        .times(new BigNumber(totalPercentIncrease.luck).div(100).plus(1))
        .toFixed(),
      resilience: new BigNumber(attributeBed.resilience)
        .times(new BigNumber(totalPercentIncrease.resilience).div(100).plus(1))
        .toFixed(),
      bonus: new BigNumber(attributeBed.bonus)
        .times(new BigNumber(totalPercentIncrease.bonus).div(100).plus(1))
        .toFixed(),
      special: new BigNumber(attributeBed.special)
        .times(new BigNumber(totalPercentIncrease.special).div(100).plus(1))
        .toFixed(),
    };
    if (nftItem) {
      const percentTimeBonus = await this.getBonusTimesByStat(bedStats.bonus);
      const itemData =
        ITEM_DATA.find((e) => nftItem.attribute.level === e.level) ||
        ITEM_DATA[ITEM_DATA.length - 1];
      const itemPercentWithBonus = new BigNumber(percentTimeBonus).times(
        itemData.percentEffect,
      );
      bedStats[nftItem.attribute.type] = new BigNumber(
        bedStats[nftItem.attribute.type],
      )
        .times(new BigNumber(itemPercentWithBonus).div(100).plus(1))
        .toString();
    }

    return bedStats;
  }

  async toCheckInsufficientDurability(
    resilienceStat: string,
    durability: number,
  ): Promise<void> {
    const mDataResilience = await this.mService.getResilienceByStat(
      resilienceStat,
    );
    if (new BigNumber(durability).lt(mDataResilience)) {
      throw new BadRequestException(MESSAGE_TRACKING.INSUFFICIENT_DURABILITY);
    }
  }

  async getSLFTEarningByLevel(effStats: string): Promise<string> {
    return this.mService.getEfficiencyByLevel(effStats);
  }

  async getBonusTimesByStat(bonusPoint: string): Promise<string> {
    const bonusPercent = await this.mService.getBonusPercentByStat(bonusPoint);
    return new BigNumber(bonusPercent).div(100).plus(1).toFixed();
  }

  getInsuranceCostTimes(bed: Nfts): string {
    return new BigNumber(
      100 - INSURANCE_COST_PERCENT[_.lowerCase(bed.attribute.quality)],
    )
      .div(100)
      .toFixed();
  }

  async getStakingAmountTimes(userId: number): Promise<string> {
    const staking = await this.userStakeRepository.findOne({
      where: {
        userId,
      },
    });
    const stakingAmount = new BigNumber(staking?.totalStake);
    if (!staking || stakingAmount.isZero() || stakingAmount.isNaN()) {
      return '1';
    }
    const stakingPercent = TRACKING_AMOUNT_BONUS_PERCENT.find((e) =>
      stakingAmount.gt(e.min),
    ).bonusPercent;

    return new BigNumber(stakingPercent).div(100).plus(1).toFixed();
  }

  async getPositiveEffect(wallet: string): Promise<[string, number]> {
    const bedAmount = await this.nftAttributesRepository.count({
      where: {
        owner: wallet,
        type: NFT_TYPE.BEDS,
      },
    });
    const indexMinPositive = POSITIVE_EFFECT_DATA.findIndex(
      (e) => e.bedAmount <= bedAmount,
    );
    const minPositiveMilestone = POSITIVE_EFFECT_DATA[indexMinPositive];
    const maxPositiveMilestone = POSITIVE_EFFECT_DATA[indexMinPositive - 1];
    const calculatePercent = calculateChangeNumber(
      bedAmount,
      minPositiveMilestone?.bedAmount,
      maxPositiveMilestone?.bedAmount,
      minPositiveMilestone?.percent,
      maxPositiveMilestone?.percent,
    );
    return [new BigNumber(calculatePercent).div(100).toFixed(), bedAmount];
  }

  async wrapperSleepScoreByTrackingId(trackingId: number) {
    const tracking = await this.trackingRepository.findOne(trackingId);
    const healthAppData = await this.healthAppDataRepo.find({
      where: {trackingId: tracking.id},
    });
    const sleepScore = await this.getSleepScoreByTrackingId(
      tracking,
      tracking.userId,
      healthAppData,
    );
    return sleepScore;
  }

  async getSleepScoreByTrackingId(
    sleepTracking: Tracking,
    userId: number,
    healthAppData: HealthAppData[],
  ): Promise<number> {
    let sleepScore = 0;

    if (!healthAppData.length) return sleepScore;

    // get info sleep at table tracking.
    if (!sleepTracking) return sleepScore;

    // Time till Onset of Sleep
    const trackingResultData = this.formatTrackingResultFromHealthAppData(healthAppData, sleepTracking.startSleep)
    if (parseInt(trackingResultData.sleepOnsetTime)) {
      const atGoBed = moment.unix(parseInt(trackingResultData.sleepOnsetTime))
      const sGoBed = moment(Number(sleepTracking.startSleep) * 1000);
      const actualScheduleDiffTime = moment
        .duration(atGoBed.diff(sGoBed))
        .asMinutes();
      const getScore = (t) => {
        if (t < TIME_ON_SLEEP_TIME_RANGE.WITH_15_MIN) {
          return TIME_ON_SLEEP_SCORE.WITH_15_MIN;
        }

        if (t < TIME_ON_SLEEP_TIME_RANGE.WITH_30_MIN) {
          return TIME_ON_SLEEP_SCORE.WITH_30_MIN;
        }

        if (t < TIME_ON_SLEEP_TIME_RANGE.WITH_60_MIN) {
          return TIME_ON_SLEEP_SCORE.WITH_60_MIN;
        }
        return 0;
      };

      sleepScore += getScore(actualScheduleDiffTime);

      // Case Where Tracking Been Ended before the Alarm
      const atWakeUp = moment.unix(parseInt(trackingResultData.wokeUpTime))
      const sWakeUp = moment(Number(sleepTracking.wakeUp) * 1000);
      const m = moment.duration(atWakeUp.diff(sWakeUp)).asMinutes();
      const enaleAlarm = sleepTracking.alrm;

      // only enable alarm then calculate score before or after alarm
      if (enaleAlarm) {
        if (m > 0) {
          // Case Where Tracking Been Ended before the Alarm 3.2
          const getScore = (t) => {
            if (t < WOKE_UP_AFTER_ALARM.WITH_15_MIN) {
              return WOKE_UP_AFTER_ALARM_SCORE.WITH_15_MIN;
            }
            return 0;
          };
          sleepScore += getScore(m);
        } else {
          // Case Where Tracking Been Ended before the Alarm 3.2
          const getScore = (t) => {
            const absVal = Math.abs(t);
            if (absVal < WOKE_UP_BEFORE_ALARM.WITH_FROM_0_MIN_TO_10) {
              return WOKE_UP_BEFORE_ALARM_SCORE.WITH_FROM_0_MIN_TO_10;
            }

            if (absVal < WOKE_UP_BEFORE_ALARM.WITH_FROM_10_MIN_TO_20) {
              return WOKE_UP_BEFORE_ALARM_SCORE.WITH_FROM_10_MIN_TO_20;
            }

            if (absVal < WOKE_UP_BEFORE_ALARM.WITH_FROM_20_MIN_TO_30) {
              return WOKE_UP_BEFORE_ALARM_SCORE.WITH_FROM_20_MIN_TO_30;
            }

            if (absVal < WOKE_UP_BEFORE_ALARM.WITH_FROM_30_MIN_TO_60) {
              return WOKE_UP_BEFORE_ALARM_SCORE.WITH_FROM_30_MIN_TO_60;
            }

            if (absVal < WOKE_UP_BEFORE_ALARM.WITH_FROM_60_MIN_TO_120) {
              return WOKE_UP_BEFORE_ALARM_SCORE.WITH_FROM_60_MIN_TO_120;
            }
            return 0;
          };
          sleepScore += getScore(m);
        }
      }
    }

    // Bed Time Compared to the Average Bed Time
    const avgBedTimeList = await this.getAverageBedTime(userId);
    const avgBTScore = this.calcBedTimeAvgBed(
      avgBedTimeList,
      Number(sleepTracking.startSleep),
    );
    sleepScore += avgBTScore;

    // Sleep Duration with Bed Types
    const bedsType = sleepTracking.bedType;
    const bedTypeTime = BED_TYPE_TIME[bedsType.toUpperCase()];
    const minBedTime = bedTypeTime.Min * 60;
    const maxBedTime = bedTypeTime.Max * 60;

    const getScoreBetTime = (b, t) => {
      if (_.lowerCase(b) === _.lowerCase(BED_TYPE.SHORT)) {
        if ((0 < t && t < minBedTime) || t > maxBedTime) {
          return BED_TYPE_TIME_SCORE.SHORT.Min;
        }

        if (minBedTime <= t && t < maxBedTime) {
          return BED_TYPE_TIME_SCORE.SHORT.Max;
        }

        return 0;
      }

      if (_.lowerCase(b) === _.lowerCase(BED_TYPE.MIDDLE)) {
        if ((0 < t && t < minBedTime) || t > maxBedTime) {
          return BED_TYPE_TIME_SCORE.MIDDLE.Min;
        }

        if (minBedTime <= t && t < maxBedTime) {
          return BED_TYPE_TIME_SCORE.MIDDLE.Max;
        }

        return 0;
      }

      if (_.lowerCase(b) === _.lowerCase(BED_TYPE.LONG)) {
        if ((0 < t && t < minBedTime) || t > maxBedTime) {
          return BED_TYPE_TIME_SCORE.LONG.Min;
        }

        if (minBedTime <= t && t < maxBedTime) {
          return BED_TYPE_TIME_SCORE.LONG.Max;
        }

        return 0;
      }

      if (_.lowerCase(b) === _.lowerCase(BED_TYPE.FLEXIBLE)) {
        if ((0 < t && t < minBedTime) || t > maxBedTime) {
          return BED_TYPE_TIME_SCORE.FLEXIBLE.Min;
        }

        if (minBedTime <= t && t < maxBedTime) {
          return BED_TYPE_TIME_SCORE.FLEXIBLE.Max;
        }

        return 0;
      }
      return 0;
    };
    sleepScore += getScoreBetTime(bedsType, parseInt(trackingResultData.timeInBed));

    return sleepScore;
  }

  async estimateEarnWrapperApi(
    userId: number,
  ): Promise<ESTIMATE_TRACKING_RESPONSE> {
    const user = await this.userRepository.findOne(userId);
    // const nftBed = await this.nftService.getAvailableNftBed(
    //   estimateEarnDto.bedUsed,
    // );
    // if (_.lowerCase(nftBed.attribute?.owner) !== _.lowerCase(user.wallet)) {
    //   throw new BadRequestException(MESSAGE_TRACKING.INVALID_BED);
    // }
    // let itemNft = null;
    // if (estimateEarnDto.itemUsed) {
    //   itemNft = await this.nftRepository.findOne({
    //     where: {
    //       id: estimateEarnDto.itemUsed,
    //       categoryId: CATEGORY_ID[CATEGORY_NAME.ITEM],
    //     },
    //     relations: ['attribute'],
    //   });
    //   if (!itemNft || !itemNft.attribute) {
    //     throw new BadRequestException(MESSAGE_TRACKING.INVALID_ITEM);
    //   } else if (itemNft.isLock) {
    //     throw new BadRequestException(MESSAGE_TRACKING.ITEM_LOCKED);
    //   } else if (
    //     _.lowerCase(itemNft.attribute?.owner) !== _.lowerCase(user.wallet)
    //   ) {
    //     throw new BadRequestException(MESSAGE_TRACKING.INVALID_ITEM);
    //   }
    // }
    const todayEarn = await this.trackingResultService.totalEarnTodayByUser(user.id)
    const maxEarnPerDay = await this.settingService.getSetting(KEY_SETTING.SLEEP_TRACKING_MAX_EARN_PER_DAY);
    return {
      todayEarn: todayEarn?.total || 0,
      maxEarnPerDay: Number(maxEarnPerDay?.value) || 800
    }
    // return this.estimateEarnTracking(estimateEarnDto, user, true);
  }

  durabilityLeftTimes(dura: number): number {
    const MIN_DURABILITY_TIMES = 90;
    const PERCENT_SLFT_BELOW_MIN_DURABILITY = 0.7;
    return new BigNumber(dura).gte(MIN_DURABILITY_TIMES)
      ? 1
      : PERCENT_SLFT_BELOW_MIN_DURABILITY;
  }

  async getDurabilityReduce(resilence: string, bedAmount: number) {
    const durabilityReduce = await this.mService.getResilienceByStat(resilence);
    const reduceWithBedAmount = DURABILITY_INCREASE_BY_BED_AMOUNT.find(
      (e) => bedAmount >= e.min,
    );
    return new BigNumber(durabilityReduce)
      .times(reduceWithBedAmount?.times || 1)
      .toString();
  }

  async estimateEarnTracking(
    estimateEarnDto: EstimateEarnDto,
    user: User,
    isPerfectCase: boolean,
    sleepScore = 100,
  ): Promise<any> {
    const nftBed = await this.nftRepository.findOne(estimateEarnDto.bedUsed, {
      relations: ['attribute'],
    });
    let itemNft = null;
    if (estimateEarnDto.itemUsed) {
      itemNft = await this.nftRepository.findOne(estimateEarnDto.itemUsed, {
        relations: ['attribute'],
      });
    }
    const nftsJewel = await this.bedInformationRepository.getBedSocket(
      nftBed.id,
    );
    const totalStats = await this.totalBedStats(
      nftBed.attribute,
      nftsJewel,
      itemNft,
    );
    const [positiveEffect, bedAmount] = await this.getPositiveEffect(
      user.wallet,
    );
    const [slftTokenAmount, stakingAmountTimes, durabilityReduce] = await Promise.all([
      this.getSLFTEarningByLevel(
        totalStats.efficiency,
      ),
      this.getStakingAmountTimes(user.id),
      this.getDurabilityReduce(
        totalStats.resilience,
        bedAmount,
      )
    ])
    const insuranceTimes = estimateEarnDto.isEnableInsurance
      ? this.getInsuranceCostTimes(nftBed)
      : '1';


    const estimateSlftEarn = new BigNumber(slftTokenAmount)
      .times(stakingAmountTimes)
      .times(insuranceTimes)
      .times(new BigNumber(sleepScore).div(100))
      .times(positiveEffect)
      .toFixed();
    // const item = await this.nftRepository.findOne(trackingRecord.itemUsed);
    // const bedSockets = await this.bedInformationRepository.findOne({bedId: trackingRecord.bedUsed});
    // const jewelIds = [bedSockets.jewelSlot1, bedSockets.jewelSlot2, bedSockets.jewelSlot3, bedSockets.jewelSlot4, bedSockets.jewelSlot5]
    //   .filter((e) => !!e)
    // const nftsJewel = await this.nftAttributesRepository.find({
    //   where: {
    //     nftId: In(jewelIds)
    //   }
    // })
    return {
      bedAmount,
      totalStats,
      slftTokenAmount,
      stakingAmountTimes,
      insuranceTimes,
      sleepScore,
      positiveEffect,
      estimateSlftEarn,
      durabilityReduce,
    };
  }

  async getTrackingResult(trackingId: number): Promise<TrackingResult> {
    const trackingResult = await this.trackingResultRepository.findOne({
      where: {trackingId},
    });
    if (!trackingResult) {
      throw new BadRequestException('Tracking result does not exists.');
    }
    return trackingResult;
  }

  async getStatusTracking(ctx: RequestContext) {
    const trackingOpening = await this.trackingRepository.findOne({
      where: {
        userId: ctx.user.id,
        status: STATUS_TRACKING.SLEEPING,
      },
    });
    if (trackingOpening) {
      const nftBed = await this.nftAttributesRepository.findOne({
        where: {
          nftId: trackingOpening.bedUsed,
        },
      });
      delete trackingOpening.efficiency;
      delete trackingOpening.luck;
      delete trackingOpening.bonus;
      delete trackingOpening.special;
      delete trackingOpening.resilience;
      return {
        tracking: {
          ...trackingOpening,
          bedImage: nftBed.image,
        },
        isAvailable: false,
        availableAt: 0,
      };
    }
    const lastTrackingResult = await this.trackingResultRepository.findOne({
      where: {userId: ctx.user.id},
      order: {createdAt: 'DESC'},
    });
    const now = moment();
    // const DELAY_HOURS_FOR_NEXT_SLEEP_TIME = 12;
    const HASH_TIME_FOR_TESTER_IN_MINUTES = 1;
    if (
      !lastTrackingResult ||
      moment(now).diff(lastTrackingResult.createdAt, 'minutes') >=
      HASH_TIME_FOR_TESTER_IN_MINUTES
    ) {
      return {
        tracking: null,
        isAvailable: true,
        availableAt: 0,
      };
    }
    return {
      tracking: null,
      availableAt: moment(lastTrackingResult.createdAt)
        .add(HASH_TIME_FOR_TESTER_IN_MINUTES, 'minutes')
        .unix(),
      isAvailable: false,
    };
  }

  async getAverageBedTime(user_id: number) {
    return await this.trackingResultRepository
      .createQueryBuilder('tr')
      .where('tr.user_id = :user', {
        user: user_id,
      })
      .orderBy('tr.id', 'DESC')
      .limit(7)
      .getMany();
  }

  calcBedTimeAvgBed(getAverageBedTime: any = [], bedTimes: number) {
    // if user don't have any records sleep tracking before
    if (!getAverageBedTime.length || getAverageBedTime.length < 7) {
      return BED_TIME_COMPARE_AVERAGE_SCORE.DEFAULT;
    }
    // get average from bed time of user
    const totalTime = getAverageBedTime
      .map((x) => {
        const startSleepTime = moment.unix(x.startSleepTime);
        return startSleepTime.hours() * 60 + startSleepTime.minutes();
      })
      .reduce((prev, next) => prev + next);
    const avgTime = totalTime / getAverageBedTime.length;

    // handle spanning days
    const MINUTES_PER_HOURS = 60;
    const m = avgTime % MINUTES_PER_HOURS;
    const h = Math.floor(avgTime / MINUTES_PER_HOURS);
    const cDateOfAvgTime = moment(new Date().setHours(h, m, 0));
    if (h <= 12) {
      cDateOfAvgTime.add(1, 'days');
    }

    const bTimeD = moment.unix(bedTimes);
    const hB = bTimeD.hours();
    const mB = bTimeD.minutes();
    const cDateOfBedTime = moment().hours(hB).minutes(mB)
    if (hB <= 12) {
      cDateOfBedTime.add(1, 'days');
    }

    // get duration between
    const duration = moment.duration(
      moment(cDateOfBedTime).diff(cDateOfAvgTime),
    );
    const mins = duration.asMinutes();
    const getScore = (mins) => {
      const absMins = Math.abs(mins);
      if (absMins < BED_TIME_COMPARE_AVERAGE.BEFORE_AND_AFTER_60) {
        return BED_TIME_COMPARE_AVERAGE_SCORE.BEFORE_AND_AFTER_60;
      }

      if (absMins < BED_TIME_COMPARE_AVERAGE.BEFORE_AND_AFTER_90) {
        return BED_TIME_COMPARE_AVERAGE_SCORE.BEFORE_AND_AFTER_90;
      }

      if (absMins < BED_TIME_COMPARE_AVERAGE.BEFORE_AND_AFTER_120) {
        return BED_TIME_COMPARE_AVERAGE_SCORE.BEFORE_AND_AFTER_120;
      }

      if (absMins < BED_TIME_COMPARE_AVERAGE.BEFORE_AND_AFTER_150) {
        return BED_TIME_COMPARE_AVERAGE_SCORE.BEFORE_AND_AFTER_150;
      }
      return 0;
    };
    return getScore(mins);
  }

  formatTrackingResultFromHealthAppData(
    healthAppData: HealthAppData[],
    bedTime: string,
  ): HealAppData {
    const sleepInBed = healthAppData.find(
      (x) => x.dataType === HEATH_APP_TYPE_DATA.SLEEP_IN_BED.toUpperCase(),
    );
    const sleepAwake = healthAppData.filter(
      (x) => x.dataType === HEATH_APP_TYPE_DATA.SLEEP_AWAKE.toUpperCase(),
    );
    if (!healthAppData.length || !sleepInBed) {
      const sleepAsSleep = healthAppData.filter(
        (x) => x.dataType === HEATH_APP_TYPE_DATA.SLEEP_ASLEEP.toUpperCase(),
      );
      if (sleepAsSleep.length && _.upperCase(healthAppData[0].platformType) === PLATFORM_TYPE.IOS) {
        const wokeUpTime = moment(sleepAsSleep[sleepAsSleep.length - 1].dateTo).unix();
        return {
          sleepOnsetTime: String(moment(sleepAsSleep[0].dateFrom).unix()),
          timeInBed: sleepAsSleep.reduce((a, b) => new BigNumber(a).plus(b.value), new BigNumber(0)).toString(),
          wokeUpTime: String(wokeUpTime),
          nAwk: sleepAwake.length,
          startSleepTime: bedTime,
          bedTime: String(bedTime),
          sleepDurationTime: moment(sleepAsSleep[sleepAsSleep.length - 1].dateTo)
            .diff(Number(bedTime) * 1000, 'minutes')
            .toString(),
        }
      }
      return {
        sleepOnsetTime: '0',
        sleepDurationTime: '0',
        wokeUpTime: moment().unix().toString(),
        bedTime: String(bedTime),
        nAwk: 0,
        startSleepTime: bedTime,
        timeInBed: '0',
      };
    }

    const sleepOnsetTime = moment(sleepInBed.dateFrom).isBefore(Number(bedTime) * 1000)
      ? String(bedTime)
      : String(moment(sleepInBed.dateFrom).unix());
    return {
      sleepOnsetTime,
      timeInBed: String(moment(sleepInBed.dateTo).diff(parseInt(sleepOnsetTime) * 1000, 'minutes')),
      wokeUpTime: String(moment(sleepInBed.dateTo).unix()),
      bedTime: String(bedTime),
      nAwk: sleepAwake.length,
      startSleepTime: bedTime,
      sleepDurationTime: moment(sleepInBed.dateTo)
        .diff(Number(bedTime) * 1000, 'minutes')
        .toString(),
    };
  }

  async wakeUp(wakeUpDto: WakeUpResultDto, userId: number) {
    const queryRunner = this.connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const trackingRecord = await queryRunner.manager
        .getRepository(Tracking)
        .createQueryBuilder('track')
        .where('track.userId = :userId AND track.status = :status', {
          userId,
          status: STATUS_TRACKING.SLEEPING,
        })
        .setLock('pessimistic_write')
        .getOne();
      if (!trackingRecord) {
        throw new BadRequestException(MESSAGE_TRACKING.TRACKING_IS_NOT_OPEN);
      }
      const [nftBed, nftsJewel, user] = await Promise.all([
        this.nftRepository.findOne(trackingRecord.bedUsed, {
          relations: ['attribute'],
        }),
        this.bedInformationRepository.getBedSocket(trackingRecord.bedUsed),
        this.userRepository.findOne(userId),
      ]);
      const healthAppData = this.healthAppDataSevice.formatDataHealApp(
        {
          trackingId: trackingRecord.id,
          datas: wakeUpDto.datas,
        },
        user.wallet,
      );
      const sleepScore = await this.getSleepScoreByTrackingId(
        trackingRecord,
        userId,
        healthAppData,
      );
      let trackingResult = null;
      const estimatedData = await this.estimateEarnTracking(
        {
          itemUsed: trackingRecord.itemUsed,
          bedUsed: trackingRecord.bedUsed,
          isEnableInsurance: trackingRecord.enableInsurance,
        },
        user,
        false,
        sleepScore,
      );

      //Insert healthAppData
      if (healthAppData.length) {
        await queryRunner.manager
          .getRepository(HealthAppData)
          .insert(healthAppData);
      }

      //Unlock bed and item
      await queryRunner.manager
        .getRepository(Nfts)
        .update(nftBed.id, {isLock: LOCK_STATUS_NFT.UNLOCK});
      if (trackingRecord.itemUsed) {
        await queryRunner.manager
          .getRepository(Nfts)
          .update(
            nftBed.id,
            {
              id: trackingRecord.itemUsed,
              isLock: LOCK_STATUS_NFT.UNLOCK,
            });
      }

      //minus durability
      const availableDurability = new BigNumber(
        nftBed.attribute.durability,
      ).minus(new BigNumber(estimatedData.durabilityReduce).abs().toString());
      const newDurability = availableDurability.lt(0)
        ? 0
        : availableDurability.toNumber();

      // if newDurability < 90 then estimateSlftEarn = estimateSlftEarn * 70%
      if (newDurability < 90) {
        this.durabilityLeftTimes(nftBed.attribute.durability);
        estimatedData.estimateSlftEarn = new BigNumber(
          estimatedData.estimateSlftEarn,
        )
          .times(0.7)
          .toFixed();
      }

      //update tracking status
      await queryRunner.manager
        .getRepository(Tracking)
        .update(
          trackingRecord.id,
          {
            status: STATUS_TRACKING.WOKE_UP,
            actualEarn: estimatedData.estimateSlftEarn,
          });

      //create tracking result
      const dataResult = this.formatTrackingResultFromHealthAppData(
        healthAppData,
        trackingRecord.startSleep,
      );
      trackingResult = await queryRunner.manager
        .getRepository(TrackingResult)
        .save({
          hashId: uuidv4(),
          userId: String(user.id),
          trackingId: trackingRecord.id,
          actualEarn: estimatedData.estimateSlftEarn,
          tokenEarnSymbol: TOKEN_SYMBOL,
          nAwk: dataResult.nAwk,
          sleepOnsetTime: dataResult.sleepOnsetTime,
          sleepDurationTime: dataResult.sleepDurationTime,
          wokeUpTime: dataResult.wokeUpTime,
          bedTime: dataResult.bedTime,
          sleepQuality: sleepScore,
          startSleepTime: Number(dataResult.startSleepTime),
          dateTime: moment
            .unix(Number(dataResult.startSleepTime))
            .format('YYYY-MM-DD'),
          timeInBed: Number(dataResult.timeInBed),
        });

      //plus time
      const newTime = new BigNumber(nftBed.attribute.time)
        .plus(dataResult.sleepDurationTime)
        .toFixed(0);
      await queryRunner.manager
        .getRepository(NftAttributes)
        .update(nftBed.attribute.id, {
          time: +newTime,
          durability: newDurability,
        });

      let isBrokenBed = false
      if (!trackingRecord.enableInsurance) {
        //LOSE BED
        const personLoseBed = PERCENT_LOSE_BED.find(
          (e) => e.type === nftBed.attribute.quality,
        );
        isBrokenBed = isInPercent(personLoseBed.percent, 1, 100);
        if (isBrokenBed) {
          await queryRunner.manager
            .getRepository(NftAttributes)
            .update(
              nftBed.attribute.id,
              {
                isBurn: 1,
              });
        }
        //LOSE JEWEL
        if (nftsJewel.length) {
          const jewelToOwner = [];
          nftsJewel.forEach((jewel) => {
            const personLose = PERCENT_LOSE_JEWEL.find(
              (e) => e.level === jewel.level,
            );
            const isLoseJewel = isInPercent(personLose.percent, 1, 100);
            if (isLoseJewel) {
              jewel.isBurn = 1;
              jewelToOwner.push(jewel);
            }
          });
          if (jewelToOwner.length) {
            await queryRunner.manager
              .getRepository(NftAttributes)
              .save(jewelToOwner);
          }
        }
      }

      // generate lucky box
      if (sleepScore !== 0) {
        const luckFormula = await this.luckyBoxService.getLuckFomula(
          parseFloat(estimatedData.totalStats.luck),
          user.wallet,
        );
        const checkTotalLuckyBox = await this.luckyBoxRepository.find({
          userId: user.id,
        });
        if (checkTotalLuckyBox.length < LARGE_NUMBER_BOX) {
          const luckyBoxLevel = await this.luckyBoxService.getLuckyBox(
            luckFormula,
          );
          if (luckyBoxLevel) {
            const waitingTime = (
              Date.now() +
              CREATE_LUCKY_BOX.WAITING_TIME_IN_MINUTES * 60 * 1000
            ).toString();
            await queryRunner.manager.save(LuckyBox, {
              userId: user.id,
              level: luckyBoxLevel,
              waitingTime,
              speedUpCost: CREATE_LUCKY_BOX.SPEED_UP_COST.valueOf(),
              redrawRate: CREATE_LUCKY_BOX.REDRAW_RATE.valueOf(),
              openingCost: CREATE_LUCKY_BOX.OPENING_BASIC_COST.valueOf(),
              typeGift: '',
            });
          }
        }
      }
      //  Update Balance for Slft
      if (new BigNumber(estimatedData.estimateSlftEarn).gt(0)) {
        await this.spendingBalanceService.updateBalanceWithTxManager(
          estimatedData.estimateSlftEarn,
          TOKEN_SYMBOL,
          user.id,
          queryRunner,
        );
        await queryRunner.manager
          .getRepository(UserEarnTransactions)
          .insert({
            symbol: TOKEN_SYMBOL,
            trackingId: trackingRecord.id,
            trackingResultId: trackingResult.id,
            amount: estimatedData.estimateSlftEarn,
            userId: user.id,
            hashId: uuidv4(),
          });
      }
      await queryRunner.commitTransaction();
      return {
        ...trackingResult,
        isBrokenBed,
        bedTime: String(trackingResult.bedTime),
        bedNFTHoldingBonus:
          new BigNumber(estimatedData.positiveEffect).times(100).toString() +
          '%',
        stakingBonus:
          new BigNumber(estimatedData.stakingAmountTimes)
            .minus(1)
            .times(100)
            .toString() + '%',
        basePointEff: estimatedData.totalStats.efficiency,
        insurance: trackingRecord.insurance,
        enableInsurance: trackingRecord.enableInsurance,
        bed: {
          name: nftBed.attribute.name,
          classNft: nftBed.attribute.classNft,
        },
      };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  //force user stop tracking if login another device
  async forceWakeUpTracking(userId: number): Promise<void> {
    const trackingRecord = await this.trackingRepository.findOne({
      where: {
        userId,
        status: STATUS_TRACKING.SLEEPING,
      },
    });
    if (trackingRecord) {
      //Cancel this sleep tracking
      await this.trackingRepository.update(trackingRecord.id, {
        status: STATUS_TRACKING.CANCEL,
      });

      //Unlock bed and Item
      await this.nftRepository.update(trackingRecord.bedUsed, {
        isLock: LOCK_STATUS_NFT.UNLOCK,
      });
      if (trackingRecord.itemUsed) {
        await this.nftRepository.update(trackingRecord.itemUsed, {
          isLock: LOCK_STATUS_NFT.UNLOCK,
        });
      }
    }
  }
}
