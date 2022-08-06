import { BadRequestException,Injectable } from '@nestjs/common'
import { PATH_IMG } from 'crawler/constants/attributes';
import { getListTokenIdByAddress } from 'src/common/Nfts';
import { paginate } from 'src/common/Utils';

import {NftAttributesRepository} from '../nft-attributes/nft-attributes.repository';
import { GetImageNftInMintingPageDto } from './dto/get-image.dto';

@Injectable()
export class MintingPageSevice {
  constructor(
    private nftAttributesRepository: NftAttributesRepository,
  ) { 
  }

  async getImageNft(dto: GetImageNftInMintingPageDto): Promise<any> {
    try {
      const { limit, page, owner, type } = dto;
      let tokenIds = await getListTokenIdByAddress(owner, type);
      
      if (!tokenIds.length) return {
        data: [], page: page, totalItem: 0
      }
      tokenIds = paginate(tokenIds, limit, page);
      const query = this.nftAttributesRepository
        .createQueryBuilder('nft')
        .select([
          `CONCAT("${PATH_IMG[type]}", nft.image) as image`,
          'nft.nft_type'
        ])
        .where(`nft.token_id In (:tokenIds)`, {tokenIds: tokenIds})
        .andWhere(`nft.nft_type = :type`, {type: type})
        .limit(limit)
        .offset(limit * (page - 1));

        const [list, count] = await Promise.all(
          [
            query.getRawMany(),
            query.getCount()
          ]
        )
      return {
        data: list, page: page, totalItem: count
      }
    } catch (error) {
      throw new BadRequestException(error);
    }
  }
}
