import { BadRequestException, Injectable } from '@nestjs/common'
import BigNumber from 'bignumber.js';
import { isNumber } from 'class-validator';
import { createNftAttributeJson, genNftAttributeJson, handleMintNft } from 'crawler/MintNft';
import _ from 'lodash';
import { type } from 'os';
import { BedInformationRepository } from 'src/bed-information/repositories/bed-information.repository';
import { CategoryRepository } from 'src/category/category.repository';
import { CATEGORY_NAME } from 'src/category/constants';
import { getRandomWithPercent, PERCENT_CLASS, PERCENT_QUALITY } from 'src/common/LuckyBox';
import { MESSAGE } from 'src/common/messageError';
import { getCurrentNftId, mintNft } from 'src/common/Nfts';
import { getLevel } from 'src/common/Utils';
import { BedHistory } from 'src/databases/entities/bed_history.entity';
import { BedInformation } from 'src/databases/entities/bed_information.entity';
import { Category } from 'src/databases/entities/categories.entity';
import { NftLevelUp } from 'src/databases/entities/nft_level_up.entity';
import { Nfts } from 'src/databases/entities/nfts.entity';
import { SpendingBalances } from 'src/databases/entities/spending_balances.entity';
import { User } from 'src/databases/entities/user.entity';
import { NftRepository } from 'src/nfts/nfts.repository';
import { SpendingBalancesRepository } from 'src/spending_balances/spending_balances.repository';
import { STATUS_TRACKING } from 'src/tracking/constants';
import { Connection, EntityManager, In, IsNull, Not } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';

import { NftAttributes } from "../databases/entities/nft_attributes.entity";
import { BED_QUALITY, INSURANCE_COST_PERCENT, IS_BURN, NFT_LEVEL_UP_STATUS, NFT_TYPE } from "../nfts/constants";
import { BED_TYPE_TIME } from "../tracking/constants";
import { TrackingService } from "../tracking/tracking.service";
import { CATEGORY_ID, FREE, IS_LOCK, SOCKET } from './constants';
import { BedDetailDto } from "./dtos/bed-detail.dto";
import { ListItemOwnerDto } from './dtos/list-item-by-owner.dto';
import { ListJewelOwnerDto } from './dtos/list-jewel-by-owner.dto';
import { ListNftsByOwnerDto } from './dtos/list-nft-by-owner.dto';
import { ListNftsInHomePageDto } from './dtos/list-nft-in-home-page.dto';
import { NftAttributesRepository } from './nft-attributes.repository'
import { PATH_IMG } from 'crawler/constants/attributes';
@Injectable()
export class NftAttributesSevice {
  constructor(
    private readonly nftAttributesRepository: NftAttributesRepository,
    private readonly spendingBalancesRepository: SpendingBalancesRepository,
    private readonly bedInformationRepository: BedInformationRepository,
    private readonly nftRepository: NftRepository,
    private readonly connection: Connection,
    private readonly trackingService: TrackingService,
    private readonly categoryRepository: CategoryRepository
  ) {
  }

  async getDetailNft(nftId: number) {
    const detail = await this.nftAttributesRepository.findOne({ nftId })
    return detail;
  }

  async updateOwnerNft(buyerAddress: string, sellerAddress: string, nftId: number, manager: EntityManager) {
    const nft = await this.nftAttributesRepository.findOne({ nftId });
    if (buyerAddress.toLocaleLowerCase() === nft.owner.toLocaleLowerCase()) throw new Error(MESSAGE.do_not_buy_your_nft);
    // if (sellerAddress.toLowerCase() !== nft.owner.toLocaleLowerCase()) throw new Error(MESSAGE.not_owner_nft);
    await manager.update(NftAttributes, nft.id, {
      owner: buyerAddress,
      updatedAt: new Date()
    });
  }

  async getNftByOwner(owner: string, data: ListNftsByOwnerDto) {
    const { limit, page, categoryId, type } = data;
    const listNft = await this.nftAttributesRepository.createQueryBuilder('nftAttributes')
      .innerJoinAndSelect('nftAttributes.nft', 'nfts', 'nftAttributes.nftId = nfts.id')
      .leftJoinAndSelect('nfts.sales', 'saleNft')
      .where(`nftAttributes.owner = '${owner}'`)
      .andWhere('nftAttributes.is_burn = :isBurn', { isBurn: IS_BURN.FALSE })
      .orderBy('nftAttributes.updated_at', 'DESC')
      .limit(limit)
      .offset(limit * (page - 1));

    if (+categoryId) {
      listNft.andWhere(`nfts.category_id = ${categoryId}`)
      switch (+categoryId) {
        case 1:
          if (type) {
            listNft.andWhere('nftAttributes.nft_type In (:type)', { type })
          } else {
            listNft.andWhere('nftAttributes.nft_type In (:type)', { type: NFT_TYPE.BEDS })
          }
          break;
        default:
          break;
      }
    }
    const [_list, count] = await Promise.all(
      [
        listNft.getMany(),
        listNft.getCount()
      ]
    );

    const list = _list.map(x => {
      x.efficiency = parseFloat(x.efficiency.toString());
      x.luck = parseFloat(x.luck.toString());
      x.bonus = parseFloat(x.bonus.toString());
      x.special = parseFloat(x.special.toString());
      x.resilience = parseFloat(x.resilience.toString());
      x.durability = parseFloat(x.durability.toString());
      let objData = {};
      const nftSale = (x.nft.sales) ? x.nft.sales : null;
      delete x.nft.sales;
      if (x.nftType === NFT_TYPE.BEDS) {
        objData = {
          insurancePercent: INSURANCE_COST_PERCENT[_.lowerCase(x.quality)],
          startTime: BED_TYPE_TIME[x.classNft.toUpperCase()]?.Min,
          endTime: BED_TYPE_TIME[x.classNft.toUpperCase()]?.Max
        }
      }
      if (x.nftType === NFT_TYPE.BED_BOX) {
        const imagesSplited = x.image.split("/");
        x['bed_box_type'] = (imagesSplited.pop().replace(/[^0-9]/g, ''))
      }
      const data = { ...x, nftSale, ...objData };
      return data;
    })
    return { list, count }
  }

  async getItemByOwner(owner: string, listItemOwnerDto: ListItemOwnerDto) {
    try {
      const { limit, page, type, minLevel, maxLevel } = listItemOwnerDto
      const query = this.nftAttributesRepository
        .createQueryBuilder('na')
        .leftJoinAndSelect('na.nft', 'nfts', 'na.nftId = nfts.id')
        .leftJoinAndSelect('na.nftSale', 'saleNft')
        .where('na.owner = :owner', { owner })
        .andWhere(`nfts.category_id = :category_id`, { category_id: CATEGORY_ID.ITEM })
        .andWhere('nfts.is_lock = :isLock AND na.is_burn = :isBurn', { isLock: IS_LOCK.NOT_LOCK, isBurn: IS_BURN.FALSE })
        .limit(limit)
        .offset(limit * (page - 1));

      if (type.length) {
        query.andWhere('na.item_type In (:type)', { type })
      }
      if (minLevel >= 0 && maxLevel >= 0) {
        query.andWhere('na.level between :minLevel and :maxLevel', { minLevel, maxLevel })
      }
      const [_list, count] = await Promise.all(
        [
          query.getMany(),
          query.getCount()
        ]
      )

      const list = _list.map(x => {
        x.efficiency = parseFloat(x.efficiency.toString());
        x.luck = parseFloat(x.luck.toString());
        x.bonus = parseFloat(x.bonus.toString());
        x.special = parseFloat(x.special.toString());
        x.resilience = parseFloat(x.resilience.toString());
        x.durability = parseFloat(x.durability.toString())
        return x;
      })
      return { list, count };
    } catch (error) {
      console.log("---------error---------:", error);
    }
  }
  async bedDetail(bedDetailDto: BedDetailDto, owner: string) {
    try {
      const query = await this.nftAttributesRepository
        .createQueryBuilder('na')
        .leftJoinAndSelect('na.nft', 'nfts', 'na.nftId = nfts.id')
        .leftJoinAndSelect('nfts.sales', 'saleNft')
        .leftJoin('nft_categories', 'nc', 'nc.id = nfts.categoryId')
        .where(`na.nftId = ${bedDetailDto.bedId}`)

      const listJewelQuery = this.nftAttributesRepository.createQueryBuilder('na')
        .where(`nft_id in (
              (SELECT jewel_slot_1 FROM bed_information where bed_id = ${bedDetailDto.bedId})
              UNION 
              (SELECT jewel_slot_2 FROM bed_information where bed_id = ${bedDetailDto.bedId})
               UNION 
              (SELECT jewel_slot_3 FROM bed_information where bed_id = ${bedDetailDto.bedId})
               UNION 
              (SELECT jewel_slot_4 FROM bed_information where bed_id = ${bedDetailDto.bedId})
               UNION 
              (SELECT jewel_slot_5 FROM bed_information where bed_id = ${bedDetailDto.bedId})
              )`)

      const bedInforQuery = this.bedInformationRepository
        .createQueryBuilder('bi')
        .select([
          'bi.socket as socket',
          'bi.item_id as itemId',
          '(select na.image from `nft_attributes` na where na.nft_id = bi.item_id) as itemImage',
        ])
        .leftJoin('nft_attributes', 'na', 'na.nft_id = bi.bed_id')
        .where(`na.nft_id = bi.bed_id`)
        .andWhere(`na.nftId = ${bedDetailDto.bedId}`)

      const result = await query.getOne();
      const [listJewel, resultBedInfor, bedHistory, nftLevelUp] = await Promise.all([
        listJewelQuery.getMany(),
        bedInforQuery.getRawOne(),
        BedHistory.findOne({ bedId: bedDetailDto.bedId }),
        NftLevelUp.findOne({ bedId: bedDetailDto.bedId })
      ])

      let objData = {};
      if (bedDetailDto.isBase == true) {
        objData = { ...result, ...bedHistory }
      } else {
        objData = result
      }
      if (!result) {
        throw new Error(MESSAGE.nft_not_found);
      }
      let itemNft = null;
      if (bedDetailDto.itemId) {
        itemNft = await this.nftRepository.findOne(bedDetailDto.itemId, { relations: ['attribute'] })
      }
      //const totalStats = await this.trackingService.totalBedStats(result, listJewel, itemNft)
      objData['jewels'] = listJewel
      objData['socket'] = resultBedInfor?.socket
      objData['itemId'] = { id: resultBedInfor?.itemId, image: resultBedInfor?.itemImage }
      objData['remainTime'] = nftLevelUp?.remainTime || null
      const category = {
        category_id: result.nft.categoryId,
        category_name: result.type,
      }
      const nftSale = (result.nft.sales) ? result.nft.sales : null;
      delete result.nft.sales;

      return {
        ...objData,
        nftSale,
        ...category,
        insurancePercent: INSURANCE_COST_PERCENT[_.lowerCase(result.quality)],
        startTime: BED_TYPE_TIME[result.classNft.toUpperCase()]?.Min || null,
        endTime: BED_TYPE_TIME[result.classNft.toUpperCase()]?.Max || null,
      }
    }
    catch (error) {
      throw new BadRequestException(error);
    }
  }

  async getListJewelsByUser(owner: string, listNftsInHomePageDto: ListNftsInHomePageDto) {
    const { page, limit } = listNftsInHomePageDto
    const listJewelByOwner = this.nftAttributesRepository
      .createQueryBuilder('na')
      .leftJoinAndSelect('na.nft', 'nfts', 'na.nftId = nfts.id')
      .leftJoinAndSelect('nfts.sales', 'saleNft')
      .leftJoin('nft_categories', 'nc', 'nc.id = nfts.categoryId')
      .where('nc.name = :name', { name: CATEGORY_NAME.JEWEL })
      .andWhere('nfts.category_id = :category_id', { category_id: CATEGORY_ID.JEWEL })
      .andWhere('na.is_burn = :is_burn', { is_burn: IS_BURN.FALSE })
      .andWhere('na.owner = :owner', { owner })
      .andWhere('nfts.is_lock = :isLock', { isLock: IS_LOCK.NOT_LOCK })
      .limit(limit)
      .offset(limit * (page - 1));

    const [list, count] = await Promise.all(
      [
        listJewelByOwner.getMany(),
        listJewelByOwner.getCount()
      ]
    )
    return { list, count };
  }

  async addItemForBed(owner: string, bedId: number, itemId: number) {
    try {
      const checkItemOfOwner = await this.nftAttributesRepository
        .checkItemOfOwner(owner, bedId, itemId)
      if (checkItemOfOwner != 2) return { status: false, message: 'You do not own this nft' }
      const getBedByBedId = await this.bedInformationRepository.getBedByBedId(bedId)
      const checkItem = await this.nftRepository
        .createQueryBuilder('nft')
        .select(['nft.id'])
        .where('nft.id = :itemId', { itemId })
        .andWhere('nft.category_id = :category_id', { category_id: CATEGORY_ID.ITEM })
        .andWhere('nft.is_lock = :isLock', { isLock: IS_LOCK.NOT_LOCK })
        .getCount()

      if (!checkItem) { throw new Error(MESSAGE.no_items_found_or_items_used_for_another_bed); }

      // Create Transaction
      const queryRunner = this.connection.createQueryRunner();
      await queryRunner.connect();
      await queryRunner.startTransaction();
      try {
        if (!getBedByBedId) {
          const addItemForBed = new BedInformation
          addItemForBed.hashId = uuidv4();
          addItemForBed.enable = true;
          addItemForBed.bedId = bedId;
          addItemForBed.itemId = itemId;
          await queryRunner.manager.save(addItemForBed);
        }
        if (getBedByBedId && !getBedByBedId.item_id) {
          await queryRunner.manager.getRepository(BedInformation).update({ bedId: bedId }, { itemId: itemId, enable: true });
        }
        if (getBedByBedId && getBedByBedId.item_id) {
          throw new Error(MESSAGE.the_bed_has_been_added_item)
        }

        await queryRunner.manager.getRepository(Nfts).update({ id: itemId }, { isLock: IS_LOCK.USED });

        await queryRunner.commitTransaction()
      } catch (error) {
        await queryRunner.rollbackTransaction()
        throw error
      } finally {
        queryRunner.release()
      }

      return { status: 200, message: 'The bed has been successfully added' }
    }
    catch (error) {
      throw new BadRequestException('Error ' + error);
    }
  }

  async removeItemFromBed(owner, bedId, itemId) {
    try {
      const checkItemOfOwner = await this.nftAttributesRepository
        .checkItemOfOwner(owner, bedId, itemId)

      if (checkItemOfOwner != 2) { throw new Error(MESSAGE.you_do_not_own_this_nft); }

      // Create Transaction
      const queryRunner = this.connection.createQueryRunner()
      await queryRunner.connect()
      await queryRunner.startTransaction()
      try {
        const resultRemoveItem = await Promise.all([
          queryRunner.manager.getRepository(BedInformation).update({ bedId: bedId }, { itemId: null, enable: false }),
          queryRunner.manager.getRepository(Nfts).update({ id: itemId }, { isLock: IS_LOCK.NOT_LOCK })
        ])
        if (resultRemoveItem[0].affected == 1) {
          await queryRunner.commitTransaction();
          return { status: 200, message: 'Remove successfully!' }
        } else {
          throw new Error('You have no items to remove')
        }
      }
      catch (error) {
        await queryRunner.rollbackTransaction()
        throw error
      } finally {
        queryRunner.release()
      }
    }
    catch (error) {
      throw new BadRequestException('Error ' + error)
    }
  }

  async checkJewelByOwner(owner: string) {
    return await this.nftAttributesRepository
      .createQueryBuilder('na')
      .select(['na.*'])
      .leftJoin('nfts', 'n', 'n.id = na.nft_id')
      .where('na.owner = :owner', { owner })
      .andWhere('n.is_lock = :isLock', { isLock: IS_LOCK.NOT_LOCK })
      .andWhere('n.category_id = :categoryId', { categoryId: CATEGORY_ID.JEWEL })
      .getRawMany()
  }

  async checkIsSleepBedByOwner(owner: string, bedId: number) {
    return await this.nftAttributesRepository
      .createQueryBuilder('na')
      .select(['na.*'])
      .leftJoin('tracking', 't', 't.bed_used = na.nft_id')
      .leftJoin('nfts', 'n', 'n.id = na.nft_id')
      .where('na.owner = :owner', { owner })
      .andWhere('n.category_id = :categoryId', { categoryId: CATEGORY_ID.BED })
      .andWhere('t.bed_used = :bed_used', { bed_used: bedId })
      .andWhere('t.status = :status', { status: STATUS_TRACKING.SLEEPING })
      .getRawOne()
  }

  async checkBalanceByOwner(owner: string) {
    return await this.spendingBalancesRepository.findOne({ where: { wallet: owner, tokenAddress: process.env.SLFT_ADDRESS } })
  }

  async updateAmount(owner: string, fee: number, queryRunner: any) {
    try {
      const availableBalance = await this.checkBalanceByOwner(owner)
      const availableAmountBalances = new BigNumber(availableBalance.availableAmount)
      const amountBalances = new BigNumber(availableBalance.amount)
      return await queryRunner.manager.getRepository(SpendingBalances).update(
        {
          wallet: owner,
          tokenAddress: process.env.SLFT_ADDRESS
        },
        {
          availableAmount: new BigNumber(availableAmountBalances).minus(fee).toString(),
          amount: new BigNumber(amountBalances).minus(fee).toString()
        }
      )
    } catch (error) {
      console.log('-----------error----------:', error);
    }
  }

  async findBedByOwner(owner: string, bedId: number) {
    return await this.nftAttributesRepository
      .createQueryBuilder('na')
      .select(['na.*'])
      .leftJoin('nfts', 'n', 'n.id = na.nft_id')
      .where('na.owner = :owner', { owner })
      .andWhere('n.id = :id', { id: bedId })
      .andWhere('n.category_id = :category_id', { category_id: CATEGORY_ID.BED })
      .getRawOne()
  }

  async openSocket(owner: string, bedId: number) {
    try {
      const bedByOwner = await this.findBedByOwner(owner, bedId)
      if (!bedByOwner) {
        throw new Error(MESSAGE.nft_not_found);
      }
      const isSleep = await this.checkIsSleepBedByOwner(owner, bedId)
      if (isSleep) {
        throw new Error(MESSAGE.sleeping_bed);
      }
      const findBed = await this.bedInformationRepository.find({
        where: {
          bedId,
          socket: Not(IsNull())
        }
      })
      const checkLevelBed = await this.nftAttributesRepository
        .createQueryBuilder('na')
        .select(['na'])
        .leftJoin('nfts', 'n', 'n.id = na.nft_id')
        .where('na.nft_id = :nftId', { nftId: bedId })
        .andWhere('n.is_lock = :isLock', { isLock: IS_LOCK.NOT_LOCK })
        .getRawOne()

      const availableBalance = await this.checkBalanceByOwner(owner)
      const availableAmountBalances = new BigNumber(availableBalance.availableAmount)
      const amountBalances = new BigNumber(availableBalance.amount)
      if (availableAmountBalances.isLessThanOrEqualTo(0) && amountBalances.isLessThanOrEqualTo(0)) {
        throw new Error(MESSAGE.balance_not_enough + `_to_open_socket`);
      }

      // Create Transaction
      const queryRunner = this.connection.createQueryRunner();
      await queryRunner.connect();
      await queryRunner.startTransaction();
      try {
        const bedInfor = new BedInformation
        if (findBed.length == 0) {
          bedInfor.hashId = uuidv4();
          bedInfor.bedId = bedId;
          bedInfor.socket = 0;
          await bedInfor.save();
        }
        if (checkLevelBed.na_level < 5) {
          throw new Error('Not enough level to open socket!');
        }
        const checkSocket = await this.bedInformationRepository.findOne({
          where: {
            bedId
          }
        })
        if (checkSocket.socket == SOCKET.SOCKET_5) {
          throw new Error('Unable to open socket!');
        }
        if (checkSocket) {
          const newSocket = checkSocket.socket + 1;
          const baseFactor = ((newSocket >= SOCKET.SOCKET_2) && (newSocket < SOCKET.SOCKET_5)) ? 5 : 0
          if (checkLevelBed.na_level >= (baseFactor + 5 * newSocket)) {
            this.updateAmount(owner, FREE, queryRunner)
            await queryRunner.manager.getRepository(BedInformation).update({ bedId: bedId }, { socket: newSocket });
            await queryRunner.commitTransaction()
            return {
              status: 200,
              message: 'Success!'
            }
          } else {
            throw new Error('You are not level enough to open socket!');
          }
        }
        throw new Error('Not Socket')
      }
      catch (error) {
        await queryRunner.rollbackTransaction()
        throw error
      } finally {
        queryRunner.release();
      }
    }
    catch (error) {
      throw new BadRequestException(error)
    }
  }

  async findJewelByOwner(owner: string, jewelId: number) {
    return await this.nftAttributesRepository
      .createQueryBuilder('na')
      .select(['na.*'])
      .leftJoin('nfts', 'n', 'n.id = na.nft_id')
      .where('na.owner = :owner', { owner })
      .andWhere('n.id = :id', { id: jewelId })
      .andWhere('n.is_lock = :isLock', { isLock: IS_LOCK.NOT_LOCK })
      .andWhere('n.category_id = :category_id', { category_id: CATEGORY_ID.JEWEL })
      .getRawOne()
  }

  async addJewelsForBed(owner: string, listJewelOwnerDto: ListJewelOwnerDto) {
    const { bedId, jewelId } = listJewelOwnerDto
    const checkJewel = await this.checkJewelByOwner(owner)
    if (!checkJewel) {
      throw new BadRequestException(MESSAGE.you_have_no_gems_to_assign);

    }
    const findJewelByOwner = await this.findJewelByOwner(owner, jewelId)
    if (!findJewelByOwner) {
      throw new BadRequestException(MESSAGE.nft_not_found_or_jewel_is_used);
    }
    const findBedInfor = await this.bedInformationRepository
      .createQueryBuilder('bi')
      .select([
        'bi.bed_id',
        'bi.jewel_slot_1 as jewel_slot_1',
        'bi.jewel_slot_2 as jewel_slot_2',
        'bi.jewel_slot_3 as jewel_slot_3',
        'bi.jewel_slot_4 as jewel_slot_4',
        'bi.jewel_slot_5 as jewel_slot_5',
        'bi.socket as socket'
      ])
      .leftJoin('nft_attributes', 'na', 'na.nft_id = bi.bed_id')
      .where('na.owner = :owner', { owner })
      .andWhere('bi.bed_id = :bed_id', { bed_id: bedId })
      .getRawOne()

    const arrJewel = [findBedInfor.jewel_slot_1, findBedInfor.jewel_slot_2, findBedInfor.jewel_slot_3, findBedInfor.jewel_slot_4, findBedInfor.jewel_slot_5];
    if (findBedInfor.socket == arrJewel.filter(i => (isNumber(i))).length) {
      throw new BadRequestException(MESSAGE.no_socket_to_add_jewel);
    }
    for (let i = 0; i < arrJewel.length; i++) {
      if (findBedInfor.socket == 0 || !findBedInfor?.socket) {
        throw new BadRequestException(MESSAGE.the_bed_has_not_been_opened_socket);
      }
      if (arrJewel[i] != null) continue
      // Create Transaction
      const queryRunner = this.connection.createQueryRunner();
      await queryRunner.connect();
      await queryRunner.startTransaction();
      try {
        const query = `Update bed_information Set jewel_slot_${i + 1} = ${jewelId}, enable_jewel = true where bed_id = ${bedId}`
        await queryRunner.manager.getRepository(BedInformation).query(query);
        await queryRunner.manager.getRepository(Nfts).update({ id: jewelId }, { isLock: IS_LOCK.USED });
        await queryRunner.commitTransaction()
        return {
          status: 200,
          message: 'Success!'
        }
      } catch (error) {
        await queryRunner.rollbackTransaction()
        throw new BadRequestException('Error ' + error);
      } finally {
        queryRunner.release()
      }
    };
    throw new BadRequestException(MESSAGE.no_more_socket_to_assign_jewel);
  }

  async removeJewelForBed(owner: string, listJewelOwnerDto: ListJewelOwnerDto) {
    try {
      const { bedId, jewelId } = listJewelOwnerDto
      const findBedInfor = await this.bedInformationRepository
        .createQueryBuilder('bi')
        .select([
          'bi.bed_id',
          'bi.jewel_slot_1 as jewel_slot_1',
          'bi.jewel_slot_2 as jewel_slot_2',
          'bi.jewel_slot_3 as jewel_slot_3',
          'bi.jewel_slot_4 as jewel_slot_4',
          'bi.jewel_slot_5 as jewel_slot_5'])
        .leftJoin('nft_attributes', 'na', 'na.nft_id = bi.bed_id')
        .where('na.owner = :owner', { owner })
        .andWhere('bi.enable_jewel = true')
        .andWhere('bi.bed_id = :bed_id', { bed_id: bedId })
        .getRawOne()

      const arrJewel = [findBedInfor.jewel_slot_1, findBedInfor.jewel_slot_2, findBedInfor.jewel_slot_3, findBedInfor.jewel_slot_4, findBedInfor.jewel_slot_5];
      const availableBalance = await this.checkBalanceByOwner(owner)
      const availableAmountBalances = new BigNumber(availableBalance.availableAmount)
      const amountBalances = new BigNumber(availableBalance.amount)
      if (availableAmountBalances.isLessThanOrEqualTo(0) && amountBalances.isLessThanOrEqualTo(0)) {
        throw new Error(MESSAGE.balance_not_enough + `_to_remove_jewel`);
      }
      for (let i = 0; i < arrJewel.length; i++) {
        if (arrJewel[i] == jewelId) {
          // Create Transaction
          const queryRunner = this.connection.createQueryRunner();
          await queryRunner.connect();
          await queryRunner.startTransaction();
          try {
            const removeJewelQuery = `Update bed_information Set jewel_slot_${i + 1} = null where bed_id = ${bedId}`
            const resultQuery = await queryRunner.manager.getRepository(BedInformation).query(removeJewelQuery)
            await queryRunner.manager.getRepository(Nfts).update({ id: jewelId }, { isLock: IS_LOCK.NOT_LOCK })
            if (resultQuery.changedRows == 1) {
              await this.updateAmount(owner, FREE, queryRunner)
            }
            if (arrJewel.filter(Number).length == 1) {
              const query = `Update bed_information Set enable_jewel = false where bed_id = ${bedId}`
              await queryRunner.manager.getRepository(BedInformation).query(query)
            }
            await queryRunner.commitTransaction();
            return {
              status: 200,
              message: 'Success!',
            }
          } catch (error) {
            await queryRunner.rollbackTransaction();
            throw new Error(error);
          } finally {
            queryRunner.release();
          }
        }
      }
      throw new Error(MESSAGE.no_jewel_to_remove);
    }
    catch (error) {
      throw new BadRequestException(error);
    }
  }

  async listBedBoxByOwner(owner: string) {
    const resultData = await this.nftAttributesRepository
      .createQueryBuilder('na')
      .leftJoinAndSelect('na.nft', 'n', 'na.nftId = n.id')
      .where('na.type = :type', { type: NFT_TYPE.BED_BOX })
      .andWhere('na.owner = :owner', { owner })
      // .andWhere('n.is_lock = :is_lock', { is_lock: IS_LOCK.NOT_LOCK })
      .andWhere('na.is_burn = :is_burn', { is_burn: IS_BURN.FALSE })
      .andWhere('n.category_id = :categoryId', { categoryId: CATEGORY_ID.BED })
      .getMany();

    return resultData.map(x => {
      const imagesSplited = x.image.split("/");
      x['bed_box_type'] = (imagesSplited.pop().replace(/[^0-9]/g, ''))
      return x;
    })
  }

  async checkBedBoxByOwner(owner: string, bedboxId: number) {
    return await this.nftAttributesRepository
      .createQueryBuilder('na')
      .select([
        'na.nft_id as bedboxId',
        'na.parent_1 as parent_1',
        'na.parent_2 as parent_2',
        'na.contract_address as contractAddress',
        'na.quality as quality',
        'na.class as class',
        'na.owner as owner',
        'na.token_id as tokenId',
        'n.id as nftId',

      ])
      .leftJoin('nfts', 'n', 'na.nft_id = n.id')
      .where('na.nft_id = :nft_id', { nft_id: bedboxId })
      .andWhere('na.type = :type', { type: NFT_TYPE.BED_BOX })
      .andWhere('na.owner = :owner', { owner })
      .andWhere('n.is_lock = :is_lock', { is_lock: IS_LOCK.NOT_LOCK })
      .andWhere('n.category_id = :categoryId', { categoryId: CATEGORY_ID.BED })
      .andWhere('na.is_burn = :is_burn', { is_burn: IS_BURN.FALSE })
      .getRawOne()
  }

  async getClassOfParent1(parent1: number) {
    return await this.nftAttributesRepository
      .createQueryBuilder('na')
      .select([
        'na.nft_id as parent_1',
        'na.class as class',
      ])
      .where('na.nft_id = :parent_1', { parent_1: parent1 })
      .getRawOne()
  }

  async getClassOfParent2(parent2: number) {
    return await this.nftAttributesRepository
      .createQueryBuilder('na')
      .select([
        'na.nft_id as parent_2',
        'na.class as class',
      ])
      .where('na.nft_id = :parent_2', { parent_2: parent2 })
      .getRawOne()
  }

  async openBedBox(owner: string, bedboxId: number) {
    const checkBedboxByOwner = await this.checkBedBoxByOwner(owner, bedboxId)
    if (!checkBedboxByOwner) {
      throw new Error(MESSAGE.do_not_own_the_bedbox);
    }
    const randomQualityWithPercent = await getRandomWithPercent([{ value: checkBedboxByOwner.quality, percent: PERCENT_QUALITY }])
    if (!randomQualityWithPercent) {
      throw new Error(MESSAGE.not_random_quality);
    }
    const getClassOfParent1 = await this.getClassOfParent1(checkBedboxByOwner.parent_1)
    const getClassOfParent2 = await this.getClassOfParent2(checkBedboxByOwner.parent_2)

    const randomClassWithPercent = await getRandomWithPercent([{ value: getClassOfParent1.class, percent: PERCENT_CLASS }, { value: getClassOfParent2.class, percent: PERCENT_CLASS }])

    if (!randomClassWithPercent) {
      throw new Error(MESSAGE.not_random_quality);
    }
    // const currentNftId = await getCurrentNftId(NFT_TYPE.BEDS)
    const getMaxTokenId = await this.nftAttributesRepository.find(
      {
        where: {
          nftType: NFT_TYPE.BEDS
        },
        order: {
          tokenId: 'DESC'
        }
      }
    )

    try {
      let newBed;
      await this.connection.transaction(async (entityManager) => {
        const newNft = new Nfts
        newNft.categoryId = CATEGORY_ID.BED;
        newNft.isLock = 0;
        newNft.status = 'DEFAULT';
        const nft = await entityManager.save(newNft)

        const handleNft = await genNftAttributeJson(CATEGORY_ID.BED, nft.id, randomClassWithPercent, checkBedboxByOwner.owner, checkBedboxByOwner.contractAddress, getMaxTokenId[0].tokenId + 1)

        const newNftAttribute = new NftAttributes
        newNftAttribute.nftId = nft.id
        newNftAttribute.nftName = handleNft.nftName;
        newNftAttribute.name = handleNft.name;
        newNftAttribute.parent1 = checkBedboxByOwner.parent_1;
        newNftAttribute.parent2 = checkBedboxByOwner.parent_2;
        newNftAttribute.image = handleNft.image;
        newNftAttribute.contractAddress = checkBedboxByOwner.contractAddress;
        newNftAttribute.type = 'bed';
        newNftAttribute.nftType = 'bed';
        newNftAttribute.isMint = 1;
        newNftAttribute.isBurn = IS_BURN.FALSE;
        newNftAttribute.classNft = randomClassWithPercent;
        newNftAttribute.quality = randomQualityWithPercent;
        newNftAttribute.owner = checkBedboxByOwner.owner;
        newNftAttribute.time = 0;
        newNftAttribute.level = 0;
        newNftAttribute.bedMint = 0;
        newNftAttribute.efficiency = handleNft.efficiency;
        newNftAttribute.luck = handleNft.luck;
        newNftAttribute.bonus = handleNft.bonus;
        newNftAttribute.special = handleNft.special;
        newNftAttribute.resilience = handleNft.resilience;
        newNftAttribute.tokenId = getMaxTokenId[0].tokenId + 1
        newNftAttribute.durability = 100;
        newBed = await entityManager.save(newNftAttribute);
        newBed['startTime'] = BED_TYPE_TIME[newBed.classNft.toUpperCase()]?.Min;
        newBed['endTime'] = BED_TYPE_TIME[newBed.classNft.toUpperCase()]?.Max;

        await entityManager.update(Nfts, { id: checkBedboxByOwner.nftId }, { isLock: IS_LOCK.USED })
        await entityManager.update(NftAttributes, { nftId: checkBedboxByOwner.bedboxId }, { isBurn: 1 })
        //insert nft level up
        const newNftLevelUp = new NftLevelUp
        newNftLevelUp.bedId = nft.id;
        newNftLevelUp.levelUpTime = await (await getLevel(newBed.level)).level_time;
        newNftLevelUp.status = NFT_LEVEL_UP_STATUS.PENDING
        await entityManager.save(newNftLevelUp)
      })

      newBed.image = `${PATH_IMG[newBed.nftType]}${newBed.image}`;
      return newBed
    } catch (error) {
      throw new Error(MESSAGE.failed_to_open_bedbox);
    }

  }

  async listBedByOwnerInHomePage(owner: string, listNftsInHomePageDto: ListNftsInHomePageDto) {
    const { limit, page } = listNftsInHomePageDto;
    const listNft = await this.nftAttributesRepository.createQueryBuilder('nftAttributes')
      .innerJoinAndSelect('nftAttributes.nft', 'nfts', 'nftAttributes.nftId = nfts.id')
      .leftJoinAndSelect('nfts.sales', 'saleNft')
      .where(`nftAttributes.owner = '${owner}'`)
      .andWhere('nftAttributes.is_burn = :isBurn', { isBurn: IS_BURN.FALSE })
      .andWhere('nfts.category_id = :category_id', { category_id: CATEGORY_ID.BED })
      .andWhere('nftAttributes.nft_type = :nft_type', { nft_type: NFT_TYPE.BEDS })
      .andWhere('nfts.is_lock = :isLock', { isLock: IS_LOCK.NOT_LOCK })
      .orderBy('nftAttributes.updated_at', 'DESC')
      .limit(limit)
      .offset(limit * (page - 1));

    const [_list, count] = await Promise.all(
      [
        listNft.getMany(),
        listNft.getCount()
      ]
    );

    const list = _list.map(x => {
      x.efficiency = parseFloat(x.efficiency.toString());
      x.luck = parseFloat(x.luck.toString());
      x.bonus = parseFloat(x.bonus.toString());
      x.special = parseFloat(x.special.toString());
      x.resilience = parseFloat(x.resilience.toString());
      x.durability = parseFloat(x.durability.toString());
      let objData = {};
      const nftSale = (x.nft.sales) ? x.nft.sales : null;
      delete x.nft.sales;
      if (x.nftType === NFT_TYPE.BEDS) {
        objData = {
          insurancePercent: INSURANCE_COST_PERCENT[_.lowerCase(x.quality)],
          startTime: BED_TYPE_TIME[x.classNft.toUpperCase()].Min,
          endTime: BED_TYPE_TIME[x.classNft.toUpperCase()].Max
        }
      }
      const data = { ...x, nftSale, objData };
      return data;
    })
    return { list, count }
  }

  async getTokenId(type: string) {
    let tokenId = 1;
    const nft = await this.nftAttributesRepository.findOne({ where: { nftType: type }, order: { tokenId: 'DESC' } });
    if (!nft) return tokenId;
    tokenId = Number(nft.tokenId) + 1;
    return tokenId;
  }

  async getTokenIdByCategory(categoryId: number, manager: EntityManager) {
    let tokenId = 1;
    const category = await manager.getRepository(Category).findOne({ where: { id: categoryId } });
    if (!category) return tokenId;
    const nft = await manager.getRepository(NftAttributes).findOne({ where: { nftType: category.name }, order: { tokenId: 'DESC' } });
    if (!nft) return tokenId;
    tokenId = Number(nft.tokenId) + 1;
    return tokenId;
  }

  async getUserWalletByUserId(userId: number) {
    return this.connection.manager.getRepository(User).findOne({
      where: {
        id: userId
      }
    })
  }

  async sendOneBedToUser(userWallet) {
    const adminWallet = process.env.OWNER_NFT_WALLET
    const nft = await this.nftAttributesRepository
      .createQueryBuilder('nftAttribute')
      .leftJoin('nftAttribute.nft', 'nfts', 'nftAttribute.nftId = nfts.id')
      .where('nftAttribute.owner = :owner', { owner: adminWallet.toString() })
      .andWhere(`nfts.category_id = :category_id`, { category_id: CATEGORY_ID.BED })
      .andWhere('nfts.is_lock = :isLock AND nftAttribute.is_burn = :isBurn', { isLock: IS_LOCK.NOT_LOCK, isBurn: IS_BURN.FALSE })
      .getOne()

    if (!nft) return

    await this.nftAttributesRepository.update({ tokenId: nft.tokenId }, { owner: userWallet })
  }
}
