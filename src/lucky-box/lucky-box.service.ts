import { BadRequestException, Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm';
import BigNumber from "bignumber.js";
import moment from 'moment';
import { getLuckyBoxLevel, getRandomImage, getRandomWithPercent } from 'src/common/LuckyBox';
import { LUCKY_BOX_GIFT_LEVEL_1, LUCKY_BOX_GIFT_LEVEL_2 } from 'src/common/OpenLuckyBox';
import { minusTokenSpendingBalances } from 'src/common/Utils';
import { LuckyBox } from 'src/databases/entities/lucky_box.entity';
import { NftAttributes } from 'src/databases/entities/nft_attributes.entity';
import { Nfts } from 'src/databases/entities/nfts.entity';
import { SpendingBalances } from 'src/databases/entities/spending_balances.entity';
import { User } from 'src/databases/entities/user.entity';
import { CATEGORY_TYPE, NFT_TYPE } from 'src/nfts/constants';
import { SpendingBalancesSevice } from 'src/spending_balances/spending_balances.service';
import { DATE_NOW, TOKEN_SYMBOL } from 'src/stack_details/enum';
import { Repository } from 'typeorm';

import { IS_OPEN, LARGE_NUMBER_BOX, TOKEN_GIF, TYPE_GIFT } from './constants/enum';
import { SpeedUpInput } from './dtos/speed-up.dto';

@Injectable()
export class LuckyBoxSevice {
  constructor(
    @InjectRepository(LuckyBox)
    private luckyBoxRepository: Repository<LuckyBox>,
    private spendingBalancesService: SpendingBalancesSevice
  ) { }

  async speedUp(input: SpeedUpInput, user: User) {
    const { luckyBoxId } = input;
    const luckyBox = await this.luckyBoxRepository.findOne({ id: luckyBoxId })
    const currentTime = Number(moment(new Date))
    const timeUp = new BigNumber(luckyBox.waitingTime).minus(currentTime)
    if (!luckyBox) throw new BadRequestException('LuckyBox not found')
    const totalOfToken = new BigNumber(timeUp).times(luckyBox.speedUpCost).toString()
    await minusTokenSpendingBalances(user.id, TOKEN_SYMBOL, totalOfToken)
    luckyBox.waitingTime = new BigNumber(currentTime).toString()
    return await luckyBox.save()

  }

  async insertLuckyBox(level: number, speedUpCost: string, redrawRate: string, openingCost: string, waitingTime: number, userId: number) {
    const checkTotalLuckyBox = await this.luckyBoxRepository.find({ userId })
    if (checkTotalLuckyBox.length >= LARGE_NUMBER_BOX) throw new BadRequestException('Exceeding the amount');
    const luckyBox = new LuckyBox()
    luckyBox.userId = 0;
    luckyBox.level = level;
    luckyBox.waitingTime = waitingTime.toString();
    luckyBox.speedUpCost = speedUpCost;
    luckyBox.redrawRate = redrawRate;
    luckyBox.openingCost = openingCost;
    luckyBox.typeGift = '';
    luckyBox.image = getRandomImage();
    return luckyBox.save()
  }

  async openLuckyBox(luckyBoxId: number, user: User) {
    const luckyBox = await LuckyBox.findOne({ id: luckyBoxId, userId: user.id })
    if (!luckyBox) {
      throw new BadRequestException('Lucky Box not found');
    }
    if (luckyBox.isOpen == IS_OPEN.TRUE) throw new BadRequestException('Lucky box has been opened');
    if (new BigNumber(luckyBox.waitingTime).comparedTo(DATE_NOW) == -1) throw new BadRequestException('Not enough time ');
    const gift = luckyBox.level == 1 ? await getRandomWithPercent(LUCKY_BOX_GIFT_LEVEL_1) : await getRandomWithPercent(LUCKY_BOX_GIFT_LEVEL_2)
    await minusTokenSpendingBalances(user.id, TOKEN_SYMBOL, luckyBox.openingCost)
    return await this.openGift(gift, user.id, luckyBox)
  }

  async openGift(value: string, userId: number, luckyBox: LuckyBox) {
    const user = await User.findOne({ id: userId })
    const userWallet = user.wallet
    const gift = value.split('-')
    const giftName = gift[0]
    switch (giftName) {
      case TYPE_GIFT.JEWEL:
        return await this.insertNftGift(TYPE_GIFT.JEWEL, gift[1], parseInt(gift[2]), luckyBox, userWallet)
      case TYPE_GIFT.TOKEN:
        return await this.updateTokenGift(gift[1], gift[2], userId, luckyBox)
      case TYPE_GIFT.BEDBOX:
        return await this.insertNftGift(TYPE_GIFT.BEDBOX, gift[1], 0, luckyBox, userWallet)
      default:
        return
    }
  }

  async insertNftGift(name: string, jewelType: string, level: number, luckyBox: LuckyBox, owner: string) {
    const nft = new Nfts();
    const dataGift = await this.getDataGift(name)
    const { category, type, typeGift } = dataGift

    nft.categoryId = category
    nft.isLock = 0
    nft.status = 'DEFAULT'
    const nftSave = await nft.save()

    await this.insertNftAttribute(name, type, level, nftSave.id, jewelType, owner)

    luckyBox.nftId = nft.id
    luckyBox.isOpen = IS_OPEN.TRUE;
    luckyBox.typeGift = typeGift

    await luckyBox.save()

    return {
      status: 'success',
      gift: typeGift
    };
  }

  async updateTokenGift(symbol: string, level: string, userId: number, luckyBox: LuckyBox) {
    let amount = '0'
    switch (level) {
      case '2':
        amount = (Math.random() * 5 + 5).toString()
        break;

      case '3':
        amount = (Math.random() * 10 + 20).toString()
        break;
      default:
        amount = (Math.random() * 5).toString()

    }

    luckyBox.symbol = symbol;
    luckyBox.amount = amount;
    luckyBox.typeGift = TYPE_GIFT.TOKEN;
    luckyBox.isOpen = IS_OPEN.TRUE;
    await luckyBox.save()

    await this.spendingBalancesService.plusAmoutSpending(amount, symbol, userId)

    return {
      status: 'success',
      gift: `${amount} ${TOKEN_GIF}`
    };
  }

  async getDataGift(name: string) {
    let dataGift = {
      category: CATEGORY_TYPE.JEWEL,
      type: NFT_TYPE.JEWEL,
      typeGift: TYPE_GIFT.JEWEL
    }
    if (name == TYPE_GIFT.BEDBOX) {
      dataGift = {
        category: CATEGORY_TYPE.BED,
        type: NFT_TYPE.BED_BOX,
        typeGift: TYPE_GIFT.BEDBOX
      }
    }
    return dataGift
  }

  async insertNftAttribute(name: string, type: string, level: number, nftId: number, jewelType: string, owner: string) {
    const nftAttribute = new NftAttributes()
    nftAttribute.nftName = name;
    nftAttribute.type = type;
    nftAttribute.level = level
    nftAttribute.nftId = nftId
    nftAttribute.jewelType = jewelType
    nftAttribute.owner = owner
    nftAttribute.contractAddress = ''
    nftAttribute.tokenId = 0
    nftAttribute.time = 1
    nftAttribute.bedMint = 0
    nftAttribute.efficiency = 1
    nftAttribute.luck = 1
    nftAttribute.bonus = 1
    nftAttribute.special = 1
    nftAttribute.resilience = 1
    return await nftAttribute.save()
  }

  async getLuckFomula(luck: number, owner: string) {
    const totalBed = await NftAttributes.count({ owner, type: NFT_TYPE.BEDS })
    return (totalBed / 3) * Math.pow(luck, 0.3)
  }

  async createLuckyBox(speedUpCost: string, redrawRate: string, openingCost: string, waitingTime: number, userId: number, luckFomula: number) {
    const luckyBoxLevel = await getLuckyBoxLevel(luckFomula)
    if (luckyBoxLevel == 'nothing') return
    const luckyBox = await this.insertLuckyBox(luckyBoxLevel.split('')[2], speedUpCost, redrawRate, openingCost, waitingTime, userId)
    return luckyBox;
  }

  async getLuckyBox(luckFomula) {
    const luckyBoxLevel = await getLuckyBoxLevel(luckFomula);
    if (luckyBoxLevel == 'nothing') return
    return luckyBoxLevel.split('')[2]
  }

  async getLuckyBoxOfUser(user: User) {
    const luckyBoxs = await LuckyBox.find({ userId: user.id, isOpen: IS_OPEN.FALSE })
    return luckyBoxs.map(x => {
      const imagesSplited = x.image.split("/");
      x['lucky_box_type'] = (imagesSplited.pop().replace(/[^0-9]/g, ''))
      return x;
    })
  }
}
