import {BadRequestException, Injectable} from '@nestjs/common'
import _ from 'lodash';
import {IS_LOCK} from 'src/nft-attributes/constants'
import {NftAttributesSevice} from 'src/nft-attributes/nft-attributes.service'
import {INSURANCE_COST_PERCENT, NFT_TYPE, SORT_PRICE} from 'src/nfts/constants'
import {NftSevice} from 'src/nfts/nfts.service'
import {SpendingBalancesSevice} from 'src/spending_balances/spending_balances.service'
import {UserRepository} from 'src/user/repositories/user.repository'
import {getConnection} from "typeorm";

import {ActionHistoriesService} from "../action-histories/action-histories.service";
import {ACTION_TYPE} from "../action-histories/constants";
import {NftSales} from "../databases/entities/nft_sales.entity";
import {RequestContext} from "../shared/request-context/request-context.dto";
import {BED_TYPE_TIME} from "../tracking/constants";
import {TxHistorySevice} from "../tx-history/tx-history.service";
import {SALE_NFT_STATUS} from './constant'
import {BuyNftsInMarketPlaceDto} from './dto/buy-nft.dto'
import {ListNftsInMarketPlaceDto} from './dto/list-nft.dto'
import {MarketPlaceRepository} from './market-place.repository'

@Injectable()
export class MarketPlaceSevice {
  constructor(
    private readonly marketPlaceRepository: MarketPlaceRepository,
    private readonly userRepository: UserRepository,
    private readonly nftAttributesService: NftAttributesSevice,
    private readonly nftService: NftSevice,
    private readonly spendingBalancesSevice: SpendingBalancesSevice,
    private readonly actionHistoryService: ActionHistoriesService,
    private readonly txHistoryService: TxHistorySevice,
  ) {
  }


  async getNftInMarketPlace(listNftsInMarketPlaceDto: ListNftsInMarketPlaceDto, ownerUser) {
    const {
      page,
      limit,
      categoryId,
      sortPrice,
      type,
      classNft,
      quality,
      minLevel,
      maxLevel,
      minBedMint,
      maxBedMint
    } = listNftsInMarketPlaceDto;
    const queryAllNftInMarket = this.marketPlaceRepository
      .createQueryBuilder('saleNfts')
      .leftJoinAndSelect('saleNfts.nft', 'nfts')
      .leftJoinAndSelect('nfts.attribute', 'nft_attributes')
      .where(`saleNfts.status = :status`, {status: SALE_NFT_STATUS.ON_SALE})
      .andWhere(`nfts.is_lock = :isLock`, {isLock: IS_LOCK.ON_MARKET})
      .limit(limit)
      .offset(limit * (page - 1));

    // if (ownerUser) {
    //   queryAllNftInMarket.andWhere('nft_attributes.owner != :ownerUser', { ownerUser })
    // }

    if (sortPrice == SORT_PRICE.HIGH_PRICE) {
      queryAllNftInMarket.orderBy('cast(price as double)', 'DESC')
    }
    if (sortPrice == SORT_PRICE.LOW_PRICE) {
      queryAllNftInMarket.orderBy('cast(price as double)', 'ASC')
    }
    if (sortPrice == SORT_PRICE.LATEST) {
      queryAllNftInMarket.orderBy('saleNfts.updated_at', 'DESC')
    }

    if (!categoryId) return {list: [], count: 0}
    queryAllNftInMarket.andWhere('nfts.category_id = :categoryId', {categoryId})
    if (minLevel >= 0 && maxLevel >= 0) {
      queryAllNftInMarket.andWhere(`nft_attributes.level between ${minLevel} and ${maxLevel}`)
    }
    if (minBedMint >= 0 && maxBedMint >= 0) {
      queryAllNftInMarket.andWhere(`nft_attributes.bed_mint between ${minBedMint} and ${maxBedMint}`)
    }
    switch (+categoryId) {
      case 1:
        if (type.length) {
          queryAllNftInMarket.andWhere('nft_attributes.type In (:type)', {type})
        }
        if (classNft.length) {
          queryAllNftInMarket.andWhere('nft_attributes.class In (:class)', {class: classNft})
        }
        if (quality.length) {
          queryAllNftInMarket.andWhere('nft_attributes.quality In (:quality)', {quality})
        }
        break;
      case 2:
        if (type.length) {
          queryAllNftInMarket.andWhere('nft_attributes.jewel_type In (:type)', {type})
        }
        break;
      default:
        if (type.length) {
          queryAllNftInMarket.andWhere('nft_attributes.item_type In (:type)', {type})
        }
        break;
    }

    const [_list, count] = await Promise.all(
      [
        queryAllNftInMarket.getMany(),
        queryAllNftInMarket.getCount()
      ]
    )

    const list = _list.map(x => {
      const nftAttribute = x.nft.attribute;
      const nft = {
        category_id: x.nft.categoryId,
        is_lock: x.nft.isLock,
        status: x.status,
        price: x.price,
        transaction_fee: x.transactionsFee,
        symbol: x.symbol,
        updatedAt: x.updatedAt,
        createdAt: x.createdAt
      };
      let otherData = {};
      if (nftAttribute.nftType === NFT_TYPE.BEDS) {
        otherData = {
          insurancePercent: INSURANCE_COST_PERCENT[_.lowerCase(nftAttribute.quality)],
          startTime: BED_TYPE_TIME[nftAttribute.classNft.toUpperCase()].Min,
          endTime: BED_TYPE_TIME[nftAttribute.classNft.toUpperCase()].Max
        }
      }
      const data = {...nftAttribute, ...nft, ...otherData};
      return data;
    })
    return {list, count};
  }

  async buyNftInMarketPlace(buyNftsInMarketPlaceDto: BuyNftsInMarketPlaceDto, ctx: RequestContext) {
    try {
      const {nftId} = buyNftsInMarketPlaceDto;
      const nftSale = await this.marketPlaceRepository.findOne({nftId, status: SALE_NFT_STATUS.ON_SALE});
      if (!nftSale) {
        throw new BadRequestException('Nft is not on sale.');
      }
      const nftAttributes = await this.nftAttributesService.getDetailNft(nftId);
      const seller = await this.userRepository.findOne({where: {wallet: nftAttributes.owner}});
      const buyer = await this.userRepository.findOne(ctx.user.id);
      if (buyer.wallet === nftAttributes.owner || buyer.wallet === seller.wallet) {
        throw new BadRequestException('Not buy');
      }
      await getConnection().transaction(async manager => {
        await this.spendingBalancesSevice.balanceAmount(ctx.user.id, seller.id, nftSale.price, nftSale.transactionsFee, manager)
        await this.nftAttributesService.updateOwnerNft(buyer.wallet, seller.wallet, nftId, manager)
        await manager.update(NftSales, nftSale.id, {
          status: SALE_NFT_STATUS.NOT_ON_SALE
        })
        await this.nftService.unLockNft(nftId)
      });
      await this.txHistoryService.addHistory({
        amount: nftSale.price,
        symbol: nftSale.symbol,
        userId: ctx.user.id,
        type: ACTION_TYPE.BUY,
        targetType: nftAttributes.nftType,
        nftSaleId: nftSale.id,
        nftId,
        tokenId: String(nftAttributes.tokenId),
      })
      return {
        status: true,
        message: 'Buy success!'
      };
    } catch (e) {
      return {
        status: false,
        message: e.message
      }
    }
  }
}
