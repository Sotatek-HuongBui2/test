import { Test, TestingModule } from '@nestjs/testing';

import { ActionHistoriesService } from './action-histories.service';

describe('ActionHistoriesService', () => {
  let service: ActionHistoriesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ActionHistoriesService],
    }).compile();

    service = module.get<ActionHistoriesService>(ActionHistoriesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
