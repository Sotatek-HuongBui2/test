import { BadRequestException } from "@nestjs/common";
import BigNumber from "bignumber.js";
import { NftAttributes } from "crawler/entities/NftAttributes.entity";
import { NftLevelUp } from "crawler/entities/NftLevelUp.entity";
import { SpendingBalances } from "crawler/entities/SpendingBalance.entity";
import moment from "moment";
import { MESSAGE } from "src/common/messageError";
import { getLevel } from "src/common/Utils";
import { NUMBER_VALUE } from "src/nfts/constants";

import { KEY_IN_CACHE, NFT_LEVEL_UP_STATUS, NUMBER_DAY_IN_MONTH, NUMBER_DAY_IN_YEAR, ONE_DAY, StatusStacking } from "../constants/enum";

export class remaintingTime {
  public checkRemaintingTime = async () => {
    console.log('====================================');
    console.log(`remaintingTime`);
    console.log('====================================');
    const findStatusNftLevelUp = await NftLevelUp.find({
      where: {
        status: NFT_LEVEL_UP_STATUS.PROCESSING
      }
    })
    for (const item of findStatusNftLevelUp) {
      const bed = await this.findBed(item.bedId)
      const chekCostLevelUp = await this.getCostLevelUp(bed.level, bed.time, item.bedId)
      const updateBalance = await SpendingBalances.findOne({
        where: {
          wallet: bed.owner,
          symbol: 'slft',
          tokenAddress: process.env.SLFT_ADDRESS.toLowerCase()
        }
      })

      if (item?.remainTime && Number(item.remainTime) <= Number(moment(new Date)) && item.status == NFT_LEVEL_UP_STATUS.PROCESSING) {
        item.status = NFT_LEVEL_UP_STATUS.SUCCESS;
        item.levelUpTime = chekCostLevelUp.nextLevel.level_time;
        item.remainTime = null;
        await item.save()
        console.log('==========updateNftLevelUpSuccess=========');
        bed.level += 1
        await bed.save()
        await this.updateUserBalance(updateBalance, chekCostLevelUp.data.cost)
      }
    }
  }

  public updateUserBalance = async (userBalance: SpendingBalances, cost: number) => {
    const balance = new BigNumber(userBalance.amount);
    const availableBalance = new BigNumber(userBalance.availableAmount);
    const newCost = new BigNumber(cost);

    if (availableBalance.comparedTo(newCost) == -1 || balance.comparedTo(newCost) == -1) {
      throw new Error(MESSAGE.balance_not_enough);
    }

    userBalance.availableAmount = new BigNumber(availableBalance.minus(newCost)).toString();
    userBalance.amount = new BigNumber(balance.minus(newCost)).toString();
    return await userBalance.save()
  }


  public getCostLevelUp = async (next_level, sleep_time, bedId) => {
    // const nextLevelValue = await getLevel(next_level);
    const findBed = await NftAttributes.findOne({ where: { nftId: bedId } })
    const nextLevelValue = await getLevel(findBed.level);
    const nextLevel = await getLevel(findBed.level + 1);
    const nftLevelUp = await NftLevelUp.findOne({ bedId });
    let data = {
      cost: null,
      constSpeedUp: null,
      require_time: null,
      sleep_time: null
    };
    // not speed up
    if (nextLevelValue.level_time <= sleep_time || nftLevelUp.remainTime <= Number(moment(new Date))) {
      data = {
        cost: nextLevelValue.level_token,
        constSpeedUp: nextLevelValue.level_fee,
        require_time: nextLevelValue.level_time,
        sleep_time: sleep_time,
      };
    }
    return { data, nextLevel }
  }

  public findBed(bedId: number) {
    return NftAttributes.findOne({
      where: {
        nftId: bedId
      }
    })
  }

  public getLevelUp = async (bedId: number) => {
    try {
      const bed = await this.findBed(bedId);
      const next_level = bed.level + 1;
      const sleep_time = bed.time;
      if (next_level > NUMBER_VALUE.LEVEL) throw new BadRequestException(MESSAGE.level_is_highest);
      return this.getCostLevelUp(next_level, sleep_time, bedId)
    } catch (err) {
      throw new BadRequestException(err);
    }
  }

}
