import {Global, Module} from '@nestjs/common';
import {TypeOrmModule} from "@nestjs/typeorm";

import {ActionHistoriesController} from './action-histories.controller';
import {ActionHistoriesService} from './action-histories.service';
import {ActionHistoryRepository} from "./repositories/action-history.repository";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ActionHistoryRepository
    ])
  ],
  controllers: [ActionHistoriesController],
  providers: [ActionHistoriesService],
  exports: [ActionHistoriesService],
})
export class ActionHistoriesModule {
}
