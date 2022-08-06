import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { BigNumber } from 'bignumber.js';
import { ATTRIBUTE_CORRECTION_JEWELS, ATTRIBUTE_EFFECT, ATTRIBUTE_EFFECT_JEWELS, ATTRIBUTE_ITEMS, PATH_IMG } from 'crawler/constants/attributes';
import _ from 'lodash';
import moment from 'moment';
import process from 'process';
import { MESSAGE } from 'src/common/messageError';
import { GET_ARRAY_PERCENT_MINTING, GET_BROKEN_MINTING, GET_FEE, GET_POINT, GET_RANDOM_MINTING, MAX_BED_MINT, PERCENT_MAX } from 'src/common/minting';
import { getCurrentNftId, TYPE_CONTRACT } from 'src/common/Nfts';
import { getLevel } from 'src/common/Utils';
import { BedHistory } from 'src/databases/entities/bed_history.entity';
import { BedInformation } from 'src/databases/entities/bed_information.entity';
import { Poins } from 'src/databases/entities/bed_point.entity';
import { NftAttributes } from 'src/databases/entities/nft_attributes.entity';
import { NftLevelUp } from 'src/databases/entities/nft_level_up.entity';
import { NftSales } from 'src/databases/entities/nft_sales.entity';
import { SpendingBalances } from 'src/databases/entities/spending_balances.entity';
import { User } from 'src/databases/entities/user.entity';
import { MarketPlaceRepository } from 'src/market-place/market-place.repository';
import { IS_LOCK } from 'src/nft-attributes/constants';
import { DATE_NOW, IsLock } from 'src/stack_details/enum';
import { ACTION_TARGET_TYPE, ACTION_TYPE } from 'src/tx-history/constant';
import { getConnection } from 'typeorm';
import { Repository } from 'typeorm';
import { Connection } from 'typeorm';

import { genNftAttributeJson } from '../../crawler/MintNft'
import { CategoryRepository } from "../category/category.repository";
import { CATEGORY_ID, CATEGORY_NAME } from "../category/constants";
import { Nfts } from '../databases/entities/nfts.entity';
import { SALE_NFT_STATUS } from "../market-place/constant";
import { BaseApiResponse } from '../shared/dtos/base-api-response.dto';
import { BED_TYPE_TIME, MESSAGE_TRACKING } from "../tracking/constants";
import { TxHistorySevice } from "../tx-history/tx-history.service";
import { CATEGORY_TYPE, INSURANCE_COST_PERCENT, IS_BURN, NFT_LEVEL_UP_STATUS, NFT_TYPE_OF_CATEGORY, TOKEN_FOR_UPGRADE_ITEM, TOKEN_FOR_UPGRADE_JEWEL } from './constants';
import { NUMBER_VALUE } from './constants';
import { NFT_TYPE, SYMBOL_SALE } from './constants';
import { getFeeRepair } from './constants';
import { AttachJewelsInput } from './dtos/attach-jewels.dto';
import { ConfirmLevelUpInput } from './dtos/confirm-level-up';
import { GetListDto } from './dtos/get-list.dto';
import { LevelUpInput } from './dtos/level-up.dto';
import { MintingInput } from './dtos/minting-dto';
import { RepairBedInput } from './dtos/repair-bed.dto';
import { SellNftInput } from './dtos/sell-nft.dto';
import { UpgradeNftsInput } from './dtos/upgrade-nft.dto';
import { NftRepository } from './nfts.repository';


@Injectable()
export class NftSevice {
  private adminWallet: string
  constructor(
    private readonly nftRepository: NftRepository,
    private readonly categoryRepository: CategoryRepository,
    private readonly marketPlaceRepository: MarketPlaceRepository,
    private readonly txHistoryService: TxHistorySevice,
    private connection: Connection,
    @InjectRepository(NftAttributes)
    private nftAttributesRepository: Repository<NftAttributes>,

    @InjectRepository(NftSales)
    private nftSaleRepository: Repository<NftSales>,
  ) {
    this.adminWallet = process.env.ADMIN_MAIN_WALLET
  }

  async lockNft(id: number): Promise<void> {
    const nft = await this.nftRepository.findOne(id);

    if (!nft) throw new BadRequestException(MESSAGE.nft_not_found);

    await this.nftRepository.update(id, {
      isLock: 1,
    });
  }

  async unLockNft(id: number): Promise<void> {
    const nft = await this.nftRepository.findOne(id);

    if (!nft) throw new BadRequestException(MESSAGE.nft_not_found);

    await this.nftRepository.update(id, {
      isLock: 0,
    });
  }

  async listNftByType(dto: GetListDto): Promise<BaseApiResponse<Nfts[]>> {
    const category = await this.categoryRepository.findOne({
      where: {
        name: dto.nftType
      }
    })

    const queryNft = this.nftRepository
      .createQueryBuilder('n')
      .leftJoinAndSelect('n.attribute', 'na', 'n.id = na.nftId')
      .where('n.categoryId = :categoryId', { categoryId: category.id })
    if (dto.tokenIds && dto.tokenIds.length) {
      queryNft.andWhere('na.token_id IN (:...tokenIds)', {
        tokenIds: dto.tokenIds,
      });
    }

    const dataNft = await queryNft.getMany();
    return {
      data: dataNft.map((e) => {
        e.attribute.efficiency = parseFloat(String(e.attribute.efficiency))
        e.attribute.luck = parseFloat(String(e.attribute.luck))
        e.attribute.bonus = parseFloat(String(e.attribute.bonus))
        e.attribute.special = parseFloat(String(e.attribute.special))
        e.attribute.resilience = parseFloat(String(e.attribute.resilience))
        e.attribute.durability = parseFloat(String(e.attribute.durability))
        return e;
      }),
      meta: {
        count: dataNft.length,
      },
    };
  }

  async getNftByType(dto: GetListDto, user: User): Promise<BaseApiResponse<Nfts[]>> {
    const category = await this.categoryRepository.findOne({
      where: {
        name: dto.nftType
      }
    })
    const owner = await User.findOne({ id: user.id })
    const queryNft = this.nftRepository
      .createQueryBuilder('n')
      .leftJoinAndSelect('n.attribute', 'na', 'n.id = na.nftId')
      .where('n.categoryId = :categoryId AND na.owner = :owner', { categoryId: category.id, owner: owner.wallet })

    const dataNft = await queryNft.getMany();
    return {
      data: dataNft,
      meta: {
        count: dataNft.length,
      },
    };
  }

  async getAvailableNftBed(nftId: number): Promise<Nfts> {
    const nftBed = await this.nftRepository.findOne({
      where: { id: nftId },
      relations: ['attribute']
    });

    if (!nftBed || !nftBed.attribute || nftBed.attribute.type !== NFT_TYPE.BEDS) {
      throw new BadRequestException(MESSAGE_TRACKING.INVALID_BED);
    } else if (nftBed.isLock) {
      throw new BadRequestException(MESSAGE_TRACKING.BED_LOCKED);
    }

    return nftBed;
  }

  async getDetailsNft(id: number) {
    const nft = await this.nftRepository.createQueryBuilder('nfts')
      .leftJoinAndSelect('nfts.attribute', 'attribute')
      .leftJoinAndSelect('nfts.category', 'category')
      .where('nfts.id = :id', { id })
      .getOne()
    return nft
  }

  async sellNft(sellNftInput: SellNftInput, user: User) {
    try {
      const { nftId, amount } = sellNftInput
      if (Number(amount) == 0) throw new BadRequestException(MESSAGE.sell_error)
      const owner = await User.findOne({ id: user.id })
      let nft = await this.nftRepository.createQueryBuilder('nft')
        .where(`nft.id = ${nftId} AND na.owner = :owner AND na.is_burn = :isBurn`, { owner: owner.wallet, isBurn: IS_BURN.FALSE })
        .leftJoin('nft_attributes', 'na', 'na.nft_id = nft.id')
        .getOne()

      const checkStatusLevelUp = await NftLevelUp.findOne(
        {
          where: {
            bedId: nftId,
            status: NFT_LEVEL_UP_STATUS.PROCESSING
          }
        }
      )
      if (checkStatusLevelUp) {
        throw new BadRequestException(MESSAGE.nft_can_not_sell)
      }
      const findSaleNft = await this.marketPlaceRepository.findOne({ where: { nftId } })
      if (!nft) throw new BadRequestException(MESSAGE.nft_not_found);
      if (nft.isLock == IsLock.TRUE) throw new BadRequestException(MESSAGE.nft_can_not_sell);
      let nftSale;

      // Create Transaction
      const queryRunner = this.connection.createQueryRunner();
      await queryRunner.connect();
      await queryRunner.startTransaction();
      try {
        if (await this.checkJewelOnBed(nftId)) {
          const fee = await this.getTransactionFee()
          if (!findSaleNft) {
            nftSale = await this.insertNftSale(nftId, amount, fee);
          } else {
            nftSale = await this.marketPlaceRepository.findOne({ nftId: nftId });
            nftSale.status = SALE_NFT_STATUS.ON_SALE;
            nftSale.price = amount;
            nftSale.transactionsFee = fee;
            nftSale.createdAt = new Date;
            nftSale.updatedAt = new Date;
          }

          await queryRunner.manager.save(nftSale);

          nft = await this.updateStatusNFt(nft)
          await queryRunner.manager.save(nft);

          await queryRunner.commitTransaction();
        }
        else {
          throw new BadRequestException(MESSAGE.bed_has_jewels);
        }
      } catch (error) {
        await queryRunner.rollbackTransaction();
        throw error;
      } finally {
        queryRunner.release();
      }

      return {
        status: 200,
        message: MESSAGE.sell_success
      }
    } catch (error) {
      throw new BadRequestException(error);
    }
  }

  async getTransactionFee() {
    return '6'
  }

  async insertNftSale(nftId: number, amount: string, fee: string) {
    const nftSale = new NftSales()
    nftSale.nftId = nftId;
    nftSale.price = amount;
    nftSale.status = SALE_NFT_STATUS.ON_SALE;
    nftSale.symbol = SYMBOL_SALE
    nftSale.transactionsFee = fee
    nftSale.createdAt = new Date
    nftSale.updatedAt = new Date
    return nftSale;
  }

  async updateStatusNFt(nft: Nfts) {
    nft.isLock = 1
    return nft;
  }

  async checkJewelOnBed(bedId: number) {
    const bed = await BedInformation.findOne({ bedId })
    for (const key in bed) {
      if (key.includes('jewelSlot') && bed[key]) {
        return false;
      }
    }
    return true;
  }

  async getAvailableNft(nftId: number, category: CATEGORY_NAME): Promise<Nfts> {
    const nftBed = await this.nftRepository.findOne({
      where: { id: nftId, categoryId: CATEGORY_ID[category] },
      relations: ['attribute']
    });

    if (!nftBed) {
      throw new BadRequestException(MESSAGE_TRACKING.INVALID_ITEM);
    } else if (nftBed.isLock) {
      throw new BadRequestException(MESSAGE_TRACKING.ITEM_LOCKED);
    }

    return nftBed;
  }

  async upgradeNft(upgradeNftsInput: UpgradeNftsInput, user: User) {
    try {
      const { nftIds, upgradeType } = upgradeNftsInput;
      const userFind = await User.findOne({ id: user.id })
      let status = true;
      let nftId;
      let msg;
      let data = {
        status: null,
        nftAttribute: null,
        msg: null
      };

      const nfts = await this.nftAttributesRepository.createQueryBuilder('na')
        .leftJoinAndSelect('na.nft', 'nfts')
        .getMany()

      const listNfts = nftIds.map((nftId) => { // Get list nft from array nftid
        const nftFind = nfts.find(item => {
          return item.nftId == nftId && item.owner == userFind.wallet && item.isBurn == IS_BURN.FALSE && item.nft.categoryId == upgradeType && item.nft.isLock == IsLock.FALSE
        })
        if (!nftFind) {
          throw new BadRequestException(MESSAGE.nft_not_found)
        }
        return nftFind
      })
      const { jewelType, level, type, itemType } = listNfts[0];
      const checkTypeJewel = listNfts.find((item) => {  // Check nfts have the same type
        return (item.jewelType != jewelType || item.level != level)
      })
      if (checkTypeJewel) {
        throw new BadRequestException(MESSAGE.invalid_nft)
      }

      const spendingBalances = await SpendingBalances.find({ userId: user.id })
      const totalTokenToUpgrade = await this.getTokenForUpgrade(level, upgradeType) // Get information to upgrade
      if (!totalTokenToUpgrade) throw new BadRequestException(MESSAGE.can_not_upgrade)

      // Create Transaction
      const queryRunner = this.connection.createQueryRunner();
      await queryRunner.connect();
      await queryRunner.startTransaction();
      try {
        const updateSpendingBalances = await this.updateSpendingBanlances(spendingBalances, totalTokenToUpgrade, queryRunner)
        await Promise.all(updateSpendingBalances) // Minus user money to upgrade

        const burnNft = listNfts.map((item) => { // Change is_burn status for nft
          item.isBurn = IS_BURN.TRUE
          return queryRunner.manager.save(item);
        })
        await Promise.all(burnNft)

        const percent = totalTokenToUpgrade.percent;
        if (await this.calculateProbabilitySuccess(percent)) {
          const nftType = upgradeType == CATEGORY_ID.Item ? NFT_TYPE_OF_CATEGORY.ITEMS : NFT_TYPE_OF_CATEGORY.JEWELS
          const nft = await this.insertNft(upgradeType, queryRunner);
          let contractAddress = null;
          let dataType;
          switch (nftType) {
            case TYPE_CONTRACT.ITEM:
              contractAddress = process.env.ITEM_CONTRACT;
              dataType = itemType;
              break;
            case TYPE_CONTRACT.JEWEL:
              contractAddress = process.env.JEWEL_CONTRACT;
              dataType = jewelType;
              break;
          };
          const tokenId = await this.getTokenId(nftType);
          const nftAttributeData = await genNftAttributeJson(upgradeType, nft.id, dataType, user, contractAddress, tokenId, level + 1);
          const nftAttribute = await this.insertRecordNftAttributes(queryRunner, nftAttributeData.nftName, nftAttributeData.type,
            nftAttributeData.nftId, nftAttributeData.jewelType, nftAttributeData.owner.wallet, nftAttributeData.itemType,
            nftAttributeData.contractAddress, nftAttributeData.tokenId, nftAttributeData.quality, nftAttributeData.level,
            nftAttributeData.classNft, nftAttributeData.image, null, null, nftAttributeData.nftType, nftAttributeData.correction, nftAttributeData.nftName);

          nftId = nftAttribute.nftId;
          msg = MESSAGE.upgrade_success;
        }
        else {
          status = false;
          msg = MESSAGE.upgrade_fail;
        }

        await queryRunner.commitTransaction();

        let dataResponse = null;
        if (nftId) {
          dataResponse = await this.nftAttributesRepository.createQueryBuilder('na').where('na.nft_id = :id', { id: nftId }).getOne();
        }

        data = {
          status,
          nftAttribute: dataResponse,
          msg
        }
        return data;
      }
      catch (error) {
        await queryRunner.rollbackTransaction();
        throw error;
      } finally {
        queryRunner.release();
      }

    }
    catch (error) {
      throw new BadRequestException(error);
    }
  }

  async updateSpendingBanlances(spendingBalances, totalTokenToUpgrade, queryRunner: any) {
    const updateSpendingBalances = spendingBalances.map((item) => {
      for (const key in totalTokenToUpgrade) {
        if (item.symbol == key) {
          if (item.availableAmount >= totalTokenToUpgrade[key]) {
            item.amount = new BigNumber(item.amount).minus(totalTokenToUpgrade[key]).toString()
            item.availableAmount = new BigNumber(item.availableAmount).minus(totalTokenToUpgrade[key]).toString()
          } else {
            throw new BadRequestException(MESSAGE.balance_not_enough)
          }
        }
      }
      return queryRunner.manager.save(item);
    })
    return updateSpendingBalances
  }

  async insertNft(categoryId: number, queryRunner: any) {
    const nft = new Nfts();
    nft.categoryId = categoryId;
    nft.isLock = IsLock.FALSE;
    nft.status = '0';

    return await queryRunner.manager.save(nft);
  }

  async insertRecordNftAttributes(queryRunner: any, nftName: string, type: string, nftId: number, jewelType: string, owner: string, itemType: string, contractAddress: string,
    tokenId: number, quality: string, level: number, classNft: string, image: string, parent_1: number, parent_2: number, nftType: string, jewelCorrection: string, name: string) {
    const nftAttribute = new NftAttributes()
    nftAttribute.nftName = nftName;
    nftAttribute.type = type;
    nftAttribute.level = level;
    nftAttribute.nftId = nftId;
    nftAttribute.jewelType = jewelType;
    nftAttribute.owner = owner;
    nftAttribute.itemType = itemType;
    nftAttribute.contractAddress = contractAddress;
    nftAttribute.tokenId = tokenId;
    nftAttribute.time = 0;
    nftAttribute.bedMint = 0;
    nftAttribute.efficiency = 0;
    nftAttribute.luck = 0;
    nftAttribute.bonus = 0;
    nftAttribute.special = 0;
    nftAttribute.resilience = 0;
    nftAttribute.quality = (quality) ? quality : '';
    nftAttribute.classNft = (classNft) ? classNft : '';
    nftAttribute.image = image;
    nftAttribute.durability = 100;
    nftAttribute.parent1 = parent_1;
    nftAttribute.parent2 = parent_2;
    nftAttribute.isMint = 0;
    nftAttribute.nftType = nftType;
    nftAttribute.jewelCorrection = jewelCorrection;
    nftAttribute.name = name;

    return await queryRunner.manager.save(nftAttribute);
  }

  async insertNftAttributes(queryRunner: any, nftName: string, type: string, level: number, owner: string, categoryId: number, jewelType: string, itemType: string, contractAddress: string,
    tokenId: number, quality: string, classNFt: string, image: string, parent_1: number, parent_2: number, nftType: string, jewelCorrection: string, name: string) {
    const nftSave = await this.insertNft(categoryId, queryRunner);
    return await this.insertRecordNftAttributes(queryRunner, nftName, type, nftSave.id, jewelType, owner, itemType, contractAddress, tokenId, quality, level, classNFt, image, parent_1, parent_2, nftType, jewelCorrection, name);
  }

  async calculateProbabilitySuccess(percent: number) {
    const ramdom = Math.random()
    console.log(Math.ceil(ramdom * 100), 'Math')
    return Math.ceil(ramdom * 100) <= percent
  }

  async updateUserBalance(userBalance: SpendingBalances, cost: any, queryRunner: any) {
    const balance = new BigNumber(userBalance.amount);
    const availableBalance = new BigNumber(userBalance.availableAmount);
    const newCost = new BigNumber(cost);

    if (availableBalance.comparedTo(newCost) == -1 || balance.comparedTo(newCost) == -1) {
      throw new Error(MESSAGE.balance_not_enough);
    }

    userBalance.availableAmount = new BigNumber(availableBalance.minus(newCost)).toString();
    userBalance.amount = new BigNumber(balance.minus(newCost)).toString();

    return await queryRunner.manager.save(userBalance);
    //return userBalance;
  }

  async repairBed(repairBedInput: RepairBedInput, user: User) {
    try {
      const { bedId, durability } = repairBedInput;
      const bed = await this.findBed(user.id, bedId);
      const userFind = await User.findOne({ id: user.id });

      if (bed.durability >= NUMBER_VALUE.DURABILITY) throw new BadRequestException(MESSAGE.bed_is_still_good);
      if (bed.durability > durability) throw new BadRequestException(MESSAGE.durability_is_better);
      const userBalance = await SpendingBalances.findOne({ tokenAddress: process.env.SLFT_ADDRESS.toLowerCase(), wallet: userFind.wallet });
      if (!userBalance) throw new BadRequestException('not_spending_balance');
      const feeRepair = await this.getFeeRepairByLevel(bed.quality, bed.level);

      const cost = feeRepair.fee * (durability - bed.durability);

      // Create Transaction
      const queryRunner = this.connection.createQueryRunner();
      await queryRunner.connect();
      await queryRunner.startTransaction();
      try {
        // update balance
        await this.updateUserBalance(userBalance, cost, queryRunner);
        // update durability
        bed.durability = durability;
        await queryRunner.manager.save(bed);

        // Add history
        await this.txHistoryService.addHistory({
          type: ACTION_TYPE.REPAIR,
          targetType: bed.nftType,
          userId: user.id,
          symbol: userBalance.symbol,
          amount: cost.toString(),
          nftId: bed.nftId,
          tokenId: bed.tokenId.toString(),
          tokenAddress: process.env.SLFT_ADDRESS
        });

        await queryRunner.commitTransaction();

        return bed;
      } catch (error) {
        await queryRunner.rollbackTransaction();
        throw error;
      } finally {
        queryRunner.release();
      }

    } catch (err) {
      if (err.message == MESSAGE.balance_not_enough) err.message = `repair_bed_${MESSAGE.balance_not_enough}`;
      throw new BadRequestException(err);
    }
  }

  async getRepairBed(bedId: number, user: User) {
    try {
      const bed = await this.findBed(user.id, bedId);
      if (!bed) throw new BadRequestException(MESSAGE.bed_not_found);
      const data = await this.getFeeRepairByLevel(bed.quality, bed.level);
      return { data };
    }
    catch (error) {
      throw new BadRequestException(error);
    }
  }

  async getFeeRepairByLevel(quality: string, level: number) {
    return await getFeeRepair(quality, level);
  }

  async updateBedPoints(bedPoints: Poins, id: number, userId: number, point: number) {
    bedPoints.bedId = id;
    bedPoints.userId = userId;
    bedPoints.bedPoint = (bedPoints.bedPoint) ? bedPoints.bedPoint + point : 0 + point;
    return bedPoints;
  }

  async levelUp(confirmLevelUpInput: ConfirmLevelUpInput, user: User) {
    try {
      const { bedId } = confirmLevelUpInput;
      const bed = await this.findBed(user.id, bedId);
      const userFind = await User.findOne({ id: user.id });
      if (bed.level >= NUMBER_VALUE.LEVEL) throw new BadRequestException(MESSAGE.level_is_highest);
      const userBalance = await SpendingBalances.findOne({ tokenAddress: process.env.SLFT_ADDRESS.toLowerCase(), wallet: userFind.wallet });
      if (!userBalance) throw new BadRequestException('not_spending_balance');
      const point = await this.getPointMinting(bed.quality);
      const checkCostLevelUp = await this.getCostLevelUp(bed.level, bed.time, bedId)
      const nftLevelUp = await NftLevelUp.findOne(
        {
          where: {
            bedId
          }
        }
      )
      // Create Transaction
      const queryRunner = this.connection.createQueryRunner();
      await queryRunner.connect();
      await queryRunner.startTransaction();
      try {
        // update user balance
        // update point
        let bedPoints = await Poins.findOne({ bedId: bed.nftId, userId: user.id });
        if (!bedPoints) {
          bedPoints = new Poins();
        }
        const updateBedPoints = await this.updateBedPoints(bedPoints, bed.nftId, user.id, point);
        await queryRunner.manager.save(updateBedPoints);

        const date = new Date()
        const speedUpFee = await this.calSpeedUpFee(nftLevelUp.remainTime, checkCostLevelUp.cost, nftLevelUp.levelUpTime)
        //update nft level up
        switch (nftLevelUp.status) {
          case NFT_LEVEL_UP_STATUS.SUCCESS:
          case NFT_LEVEL_UP_STATUS.PENDING:
            const remainTime = Number(moment(date).add(nftLevelUp.levelUpTime, 'minutes'))
            nftLevelUp.remainTime = remainTime;
            nftLevelUp.levelUpTime = checkCostLevelUp.require_time
            nftLevelUp.status = NFT_LEVEL_UP_STATUS.PROCESSING
            bed.level;
            bed.levelUpTime = Number(moment(date)).toString()
            break;
          case NFT_LEVEL_UP_STATUS.PROCESSING:
            nftLevelUp.levelUpTime = checkCostLevelUp.nextLevelTime
            nftLevelUp.remainTime = null;
            nftLevelUp.status = NFT_LEVEL_UP_STATUS.SUCCESS
            bed.level += 1;
            bed.levelUpTime = Number(moment(date)).toString()
            break;
        }

        await queryRunner.manager.save(bed);
        await queryRunner.manager.save(nftLevelUp)
        await this.updateUserBalance(userBalance, speedUpFee, queryRunner);

        // Add history
        await this.txHistoryService.addHistory({
          type: ACTION_TYPE.LEVEL_UP,
          targetType: bed.nftType,
          userId: user.id,
          symbol: userBalance.symbol,
          amount: speedUpFee,
          nftId: bed.nftId,
          tokenId: bed.tokenId.toString(),
          tokenAddress: process.env.SLFT_ADDRESS
        });

        await queryRunner.commitTransaction();
        bed['remaintingTime'] = nftLevelUp?.remainTime || null
        return bed;
      } catch (error) {
        await queryRunner.rollbackTransaction();
        throw error;
      } finally {
        queryRunner.release();
      }
    } catch (err) {
      if (err.message == MESSAGE.balance_not_enough) err.message = `level_up_${MESSAGE.balance_not_enough}`;
      throw new BadRequestException(err);
    }

  }

  async calSpeedUpFee(remainingTime, speedupFee, levelUpTime) {
    const now = new Date();
    const minutes = ((Number(remainingTime) - now.getTime()) / (1000 * 60) % 60).toFixed();
    return (new BigNumber(minutes).times(speedupFee)).div(levelUpTime).toString()
  }

  async getCostLevelUp(next_level, sleep_time, bedId) {
    const nftLevelUp = await NftLevelUp.findOne({ bedId });
    const findBed = await NftAttributes.findOne({ where: { nftId: bedId } })
    const nextLevelValue = await getLevel(findBed.level);
    const nextLevel = await getLevel(findBed.level + 1);
    const timeSpeepUp = (Number(nftLevelUp?.remainTime) - Number(moment(new Date))) / (1000 * 60)

    let data = {
      cost: null,
      costSpeedUp: null,
      require_time: null,
      sleep_time: null,
      nextLevelTime: null
    };
    // not speed up
    if (nftLevelUp.remainTime <= Number(moment(new Date))) {
      data = {
        cost: nextLevelValue.level_token,
        costSpeedUp: nextLevelValue.level_fee,
        require_time: nextLevelValue.level_time,
        sleep_time: sleep_time,
        nextLevelTime: nextLevel.level_time
      };
    }
    // Speed up
    else {
      data = {
        cost: (nextLevelValue.level_fee * timeSpeepUp) / nftLevelUp.levelUpTime,
        costSpeedUp: nextLevelValue.level_fee,
        require_time: nextLevelValue.level_time,
        sleep_time: sleep_time,
        nextLevelTime: nextLevel.level_time
      }
    }
    return data
  }

  async getLevelUp(user: User, bedId: number) {
    try {
      const bed = await this.findBed(user.id, bedId);
      const next_level = bed.level + 1;
      const sleep_time = bed.time;
      if (next_level > NUMBER_VALUE.LEVEL) throw new BadRequestException(MESSAGE.level_is_highest);
      return await this.getCostLevelUp(next_level, sleep_time, bedId)
    } catch (err) {
      throw new BadRequestException(err);
    }
  }

  async attachJewels(attachJewelsInput: AttachJewelsInput, user: User) {
    const { bedId } = attachJewelsInput;
    const bed = await this.findBed(user.id, bedId)
    return bed
  }

  async findBed(userId: number, bedId: number) {
    const userFind = await User.findOne({ id: userId });
    const bed = await NftAttributes.findOne({ nftId: bedId, owner: userFind.wallet, type: NFT_TYPE.BEDS });
    if (!bed) throw new BadRequestException(MESSAGE.bed_not_found);
    return bed;
  }

  async getTokenForUpgrade(level: number, type) {
    let listToken = TOKEN_FOR_UPGRADE_JEWEL.find((item) => {
      return item.level == level
    })
    if (type == CATEGORY_TYPE.ITEM) {
      listToken = TOKEN_FOR_UPGRADE_ITEM.find((item) => {
        return item.level == level
      })
    }
    return listToken
  }

  async getDetailMinting(bedParent1: NftAttributes, bedParent2: NftAttributes) {
    const fee = await this.getFeeMinting(bedParent1.bedMint, bedParent2.bedMint, bedParent1.quality, bedParent2.quality);
    if (!fee) throw new Error(MESSAGE.can_not_get_fee);
    const arrPercentMinting = await this.getArrPercentMinting(bedParent1.quality, bedParent2.quality);
    if (!arrPercentMinting) throw new Error(MESSAGE.can_not_get_percent_minting);
    const randomPercent = await this.getRandomMinting(bedParent1.quality, bedParent2.quality);
    if (!randomPercent) throw new Error(MESSAGE.can_not_get_percent_minting);
    const brokenRate = await this.getBrokenRateMinting(bedParent1.quality, bedParent2.quality);
    if (!brokenRate) throw new Error(MESSAGE.can_not_get_broken_rate);

    const data = {
      fee: fee,
      percentMinting: arrPercentMinting,
      randomQuality: randomPercent,
      brokenRate: brokenRate
    };

    return data;
  }

  async getMinting(bedIdParent1: number, bedIdParent2: number) {
    try {
      const bedParent1 = await this.getBedById(bedIdParent1);
      const bedParent2 = await this.getBedById(bedIdParent2);

      const data = await this.getDetailMinting(bedParent1, bedParent2);

      return data;
    } catch (error) {
      throw new BadRequestException(error);
    }
  }

  async getBedById(bedId: number) {
    const bed = await NftAttributes.findOne({ nftId: bedId, isBurn: IS_BURN.FALSE, type: NFT_TYPE.BEDS });
    if (!bed) throw new BadRequestException(MESSAGE.bed_not_found);
    return bed;
  }

  async getFeeMinting(bedMintParent1: number, bedMintParent2: number, parent1: string, parent2: string) {
    return await GET_FEE(bedMintParent1, bedMintParent2, parent1, parent2);
  }

  async getBrokenRateMinting(parent1: string, parent2: string) {
    return await GET_BROKEN_MINTING(parent1, parent2);
  }

  async getArrPercentMinting(parent1: string, parent2: string) {
    return await GET_ARRAY_PERCENT_MINTING(parent1, parent2);
  }

  async getRandomMinting(parent1: string, parent2: string) {
    return await GET_RANDOM_MINTING(parent1, parent2);
  }

  async getPointMinting(quality) {
    return await GET_POINT(quality);
  }

  async updateOneParentIsBurn(bed: NftAttributes) {
    bed.isBurn = 1;
    return bed;
  }

  async updateIsBurn(bedParent1: NftAttributes, bedParent2: NftAttributes, queryRunner: any) {
    const bed1 = await this.updateOneParentIsBurn(bedParent1);
    const bed2 = await this.updateOneParentIsBurn(bedParent2);

    await queryRunner.manager.save([bed1, bed2]);
  }

  async updateBedMintForBed(bed: NftAttributes) {
    bed.bedMint += 1;
    return bed;
  }

  async updateBedMint(bedParent1: NftAttributes, bedParent2: NftAttributes, queryRunner: any) {
    const bed1 = await this.updateBedMintForBed(bedParent1);
    const bed2 = await this.updateBedMintForBed(bedParent2);

    await queryRunner.manager.save([bed1, bed2]);
  }

  async postMinting(user: User, mintingInput: MintingInput) {
    try {
      const userFind = await User.findOne({ id: user.id });
      const userBalance = await SpendingBalances.findOne({ tokenAddress: process.env.SLFT_ADDRESS.toLowerCase(), wallet: userFind.wallet });
      if (!userBalance) throw new BadRequestException('not_spending_balance');
      const { bedIdParent1, bedIdParent2, isInsurance } = mintingInput;
      const bedParent1 = await this.getBedById(bedIdParent1);
      const bedParent2 = await this.getBedById(bedIdParent2);
      let status = true;
      let data = {
        status: null,
        nftAttribute: null,
        msg: null
      };
      let nftAttribute;

      // check bed
      if (bedParent1.bedMint > MAX_BED_MINT || bedParent2.bedMint > MAX_BED_MINT) throw new Error(MESSAGE.bed_enough_times_mint);

      // Step 1: get minting again
      const minting = await this.getDetailMinting(bedParent1, bedParent2);
      if (!minting) throw new Error(MESSAGE.minting_not_exists);

      let fee = minting.fee;
      let percentMintingSuccess = PERCENT_MAX - minting.brokenRate.brokenRate;

      // Check Insurance
      if (isInsurance) {
        // + Fee , percent 100%
        fee += (fee * minting.brokenRate.fee) / PERCENT_MAX;
        percentMintingSuccess = PERCENT_MAX;
      }

      // Create Transaction
      const queryRunner = this.connection.createQueryRunner();
      await queryRunner.connect();
      await queryRunner.startTransaction();
      try {
        // Step 2: Check and update Balance
        const getMaxTokenId = await this.nftAttributesRepository.find(
          {
            where: {
              nftType: NFT_TYPE.BED_BOX
            },
            order: {
              tokenId: 'DESC'
            }
          }
        )
        let newTokenId = getMaxTokenId[0]?.tokenId
        await this.updateUserBalance(userBalance, fee, queryRunner);
        // Success minting
        const nftSave = await this.insertNft(CATEGORY_ID.Bed, queryRunner);
        if (!getMaxTokenId.length) {
          newTokenId = 1
        } else {
          newTokenId = getMaxTokenId[0]?.tokenId + 1
        }
        const handleNft = await genNftAttributeJson(CATEGORY_ID.Bedbox, nftSave.id, 'bedbox', bedParent2.owner, bedParent2.contractAddress, newTokenId)
        if (await this.calculateProbabilitySuccess(percentMintingSuccess)) {
          // Step 3: insert nfts and nft_attribute
          nftAttribute = await this.insertNftAttributes(queryRunner, handleNft.nftName, NFT_TYPE_OF_CATEGORY.BEDBOX, 0, user.wallet, CATEGORY_TYPE.BED, '', '', process.env.BED_BOX_CONTRACT, newTokenId, minting.randomQuality, '', handleNft.image, bedIdParent1, bedIdParent2, NFT_TYPE_OF_CATEGORY.BEDBOX, null, handleNft.name);

          // Step 4: update bed mint for parent
          await this.updateBedMint(bedParent1, bedParent2, queryRunner);

          data = { status, nftAttribute, msg: MESSAGE.mint_success };
        } else {
          // Fail -> update is burn
          await this.updateIsBurn(bedParent1, bedParent2, queryRunner);

          status = false;
          data = { status, nftAttribute: null, msg: MESSAGE.mint_fail };
        }

        // Add history
        await this.txHistoryService.addHistory({
          type: ACTION_TYPE.MINT,
          targetType: nftAttribute?.nftType || null,
          userId: user.id,
          symbol: userBalance.symbol,
          amount: fee.toString(),
          nftId: nftAttribute?.nftId || null,
          tokenId: nftAttribute?.tokenId.toString() || null,
          tokenAddress: process.env.SLFT_ADDRESS
        });

        await queryRunner.commitTransaction();

        return data;

      } catch (error) {
        await queryRunner.rollbackTransaction();
        throw error;
      } finally {
        await queryRunner.release();
      }
    } catch (error) {
      if (error.message == MESSAGE.balance_not_enough) error.message = `minting_${MESSAGE.balance_not_enough}`;
      throw new BadRequestException(error);
    }
  }

  async getDetailNftByTokenId(type, tokenId) {
    let category = type
    if (type == NFT_TYPE_OF_CATEGORY.BEDBOX) category = NFT_TYPE_OF_CATEGORY.BED
    const query = this.nftAttributesRepository.createQueryBuilder('na')
      .where('na.token_id = :tokenId AND nc.name = :category', { tokenId, category: category })
      .leftJoin('nfts', 'nfts', 'nfts.id = na.nft_id')
      .leftJoin('nft_categories', 'nc', 'nc.id = nfts.category_id')

    if (type == NFT_TYPE_OF_CATEGORY.BEDBOX) {
      query.andWhere('na.type = :type', { type: NFT_TYPE_OF_CATEGORY.BEDBOX })
    }

    const nft = await query.getOne()
    if (!nft) throw new BadRequestException(MESSAGE.nft_not_found);
    const attributes = nft.isMint ? await this.getAttributesNfts(type, nft) : null
    // const prefixImg = type == "bed" ? PATH_IMG[type] : PATH_IMG[type] + nft.type + "/";
    return {
      "name": nft.nftName,
      "description": 'NFT  used in SleeFi',
      "seller_fee_basis_points": 600,
      "image": nft.image,
      "attributes": attributes,
      "collection": {
        "name": type,
        "family": "SleeFi"
      }
    }
  }

  async getAttributesNfts(key: string, data: NftAttributes) {
    switch (key) {
      case NFT_TYPE_OF_CATEGORY.BED:
        return [
          {
            "trait_type": "Bed type",
            "value": data.classNft,
          },
          {
            "trait_type": "Genesis or normal”",
            "value": Number(data.tokenId) < 10000 ? "genesis" : "normal",
          },
          {
            "trait_type": "Bed quality",
            "value": data.quality,
          },
          {
            "trait_type": "Level",
            "value": data.level,
          },
          {
            "trait_type": "Bed-minting Count",
            "value": `${data.bedMint}/7`,
          },
          {
            "trait_type": "Efficiency",
            "value": data.efficiency,
          },
          {
            "trait_type": "Luck",
            "value": data.luck,
          },
          {
            "trait_type": "Bonus",
            "value": data.bonus,
          },
          {
            "trait_type": "Special",
            "value": data.special,
          },
          {
            "trait_type": "Resilience",
            "value": data.resilience,
          },
          {
            "trait_type": "Durability",
            "value": `${data.durability}/100`,
          },
          {
            "trait_type": "Socket 1",
            "value": "unknown/empty",
          },
          {
            "trait_type": "Socket 2",
            "value": "unknown/empty",
          },
          {
            "trait_type": "Socket 3",
            "value": "unknown/empty",
          },
          {
            "trait_type": "Socket 4",
            "value": "unknown/empty",
          },
          {
            "trait_type": "Socket 5",
            "value": "unknown/empty",
          },
          {
            "trait_type": "Date elapsed since last level up",
            "value": "0",
          },
        ]
      case NFT_TYPE_OF_CATEGORY.BEDBOX:
        return [
          {
            "trait_type": "Bedbox quality",
            "value": data.quality,
          }
        ]
      case NFT_TYPE_OF_CATEGORY.JEWELS:
        return [
          {
            "trait_type": "Jewel attribute",
            "value": data.jewelType,
          },
          {
            "trait_type": "Genesis or normal”",
            "value": Number(data.tokenId) < 10000 ? "genesis" : "normal",
          },
          {
            "trait_type": "Jewel attribute2",
            "value": ATTRIBUTE_EFFECT[data.jewelType],
          },
          {
            "trait_type": "Level",
            "value": data.level,
          },
          {
            "trait_type": "attribute correction",
            "value": `${ATTRIBUTE_CORRECTION_JEWELS[data.level]}%`,
          }
        ]
      case NFT_TYPE_OF_CATEGORY.ITEMS:
        return [
          {
            "trait_type": "Item attribute",
            "value": data.itemType,
          },
          {
            "trait_type": "Item attribute2",
            "value": ATTRIBUTE_ITEMS[data.itemType],
          },
          {
            "trait_type": "Level",
            "value": data.level,
          },
          {
            "trait_type": "Effect attribute",
            "value": `${ATTRIBUTE_EFFECT_JEWELS[data.level]}%`,
          }
        ]
      default:
        return []
    }
  }

  async getFamilyNft(bedId: number) {

    const query = await this.nftAttributesRepository
      .createQueryBuilder('na')
      .leftJoinAndSelect('na.nft', 'n', 'na.nftId = n.id')
      .where('na.nft_id = :nft_id', { nft_id: bedId })
      .getOne();

    let queryParent;

    if (query.parent1 && query.parent2) {
      queryParent = await this.nftAttributesRepository
        .createQueryBuilder('na')
        .leftJoinAndSelect('na.nft', 'n', 'na.nftId = n.id')
        .where('na.nft_id IN (:...nft_id)', { nft_id: [query.parent1, query.parent2] })
        .getMany()
    } else {
      queryParent = [];
    }

    const queryChildren = await this.nftAttributesRepository
      .createQueryBuilder('na')
      .leftJoinAndSelect('na.nft', 'n', 'na.nftId = n.id')
      .where('(na.parent_1 = :parent_1 or na.parent_2 = :parent_1)', { parent_1: bedId })
      .andWhere('na.is_burn = :isBurn', { isBurn: IS_BURN.FALSE })
      .getMany();

    return { queryParent, queryChildren };
  }

  async cancelSellNft(nftId: number, user: User) {
    const userFind = await User.findOne({ id: user.id });
    try {
      const nftSale = await this.nftSaleRepository.createQueryBuilder('ns')
        .where('ns.status = :status AND na.owner = :owner AND ns.nft_id = :nftId AND n.is_lock = 1', { status: SALE_NFT_STATUS.ON_SALE, owner: userFind.wallet, nftId: nftId })
        .leftJoinAndSelect('nft_attributes', 'na', 'na.nft_id = ns.nft_id')
        .leftJoinAndSelect('nfts', 'n', 'n.id = ns.nft_id')
        .getOne();
      if (!nftSale) throw new BadRequestException(MESSAGE.nft_can_not_sell);
      nftSale.status = SALE_NFT_STATUS.NOT_ON_SALE;

      const nft = await Nfts.findOne({ id: nftId });
      if (!nft) throw new BadRequestException(MESSAGE.nft_not_found);

      // Create Transaction
      const queryRunner = this.connection.createQueryRunner();
      await queryRunner.connect();
      await queryRunner.startTransaction();

      try {
        nft.isLock = IS_LOCK.NOT_LOCK;
        await queryRunner.manager.save(nft);

        await queryRunner.manager.save(nftSale);
        await queryRunner.commitTransaction();

        return { message: MESSAGE.cancel_sell_success };
      }
      catch (error) {
        await queryRunner.rollbackTransaction();
        throw error;
      } finally {
        queryRunner.release();
      }
    } catch (error) {
      throw new BadRequestException(error);
    }
  }

  async getTokenId(type: string) {
    let tokenId = 1;
    const nft = await this.nftAttributesRepository.findOne({ where: { nftType: type }, order: { tokenId: 'DESC' } });
    if (!nft) return tokenId;
    tokenId = Number(nft.tokenId) + 1;
    return tokenId;
  }
}
