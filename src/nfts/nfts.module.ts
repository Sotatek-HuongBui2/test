import {Module} from '@nestjs/common'
import {TypeOrmModule} from '@nestjs/typeorm'
import {NftAttributes} from 'src/databases/entities/nft_attributes.entity';
import {NftSales} from 'src/databases/entities/nft_sales.entity';
import {MarketPlaceRepository} from 'src/market-place/market-place.repository';

import {ActionHistoriesModule} from "../action-histories/action-histories.module";
import {CategoryRepository} from "../category/category.repository";
import {TxHistoryModule} from "../tx-history/tx-history.module";
import {NftController} from './nfts.controller'
import {NftRepository} from './nfts.repository'
import {NftSevice} from './nfts.service'

@Module({
  imports: [
    ActionHistoriesModule,
    TxHistoryModule,
    TypeOrmModule.forFeature(
      [
        NftRepository,
        CategoryRepository,
        NftAttributes,
        NftSales,
        MarketPlaceRepository,
      ]
    )],
  controllers: [NftController],
  providers: [NftSevice],
  exports: [NftSevice]
})
export class NftModule {
}
