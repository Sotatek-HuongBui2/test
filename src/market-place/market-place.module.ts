import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { CategoryRepository } from 'src/category/category.repository'
import { NftAttributesModule } from 'src/nft-attributes/nft-attributes.module'
import { NftModule } from 'src/nfts/nfts.module'
import { NftRepository } from 'src/nfts/nfts.repository'
import { SpendingBalancesModule } from 'src/spending_balances/spending_balances.module'
import { UserRepository } from 'src/user/repositories/user.repository'

import {ActionHistoriesModule} from "../action-histories/action-histories.module";
import {TxHistoryModule} from "../tx-history/tx-history.module";
import { MarketPlaceController } from './market-place.controller'
import { MarketPlaceRepository } from './market-place.repository'
import { MarketPlaceSevice } from './market-place.service'

@Module({
  imports: [
    TypeOrmModule.forFeature([MarketPlaceRepository, CategoryRepository, NftRepository, UserRepository]),
    NftAttributesModule,
    SpendingBalancesModule,
    NftModule,
    ActionHistoriesModule,
    TxHistoryModule,
  ],
  controllers: [MarketPlaceController],
  providers: [MarketPlaceSevice]
})
export class MarketPlaceModule {}
