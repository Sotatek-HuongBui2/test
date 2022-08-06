import { Test, TestingModule } from '@nestjs/testing';

import { ActionHistoriesController } from './action-histories.controller';

describe('ActionHistoriesController', () => {
  let controller: ActionHistoriesController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ActionHistoriesController],
    }).compile();

    controller = module.get<ActionHistoriesController>(ActionHistoriesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
