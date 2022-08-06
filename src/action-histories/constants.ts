export enum ACTION_TARGET_TYPE {
  TOKEN = 'token',
  BED = 'bed',
  BED_BOX = 'bedbox',
  JEWEL = 'jewel',
  ITEM = 'item',
  LUCKY_BOX = 'luckybox',
}

export enum ACTION_TYPE {
  TRADE = 'TRADE',
  STAKING_DEPOSIT = 'STAKING_DEPOSIT',
  STAKING_WITHDRAW = 'STAKING_WITHDRAW',
  SELL = 'SELL',
  BUY = 'BUY',
  MINT = 'MINT',
  REPAIR = 'REPAIR',
  LEVEL_UP = 'LEVEL_UP',
  RECYCLING = 'RECYCLING',
  OPEN_LUCK_BOX = 'OPEN_LUCKY_BOX',
}

export interface ACTION_INSERT_TYPE_DTO {
  type: ACTION_TYPE;
  targetType: ACTION_TARGET_TYPE | string;
  userId: number;
  price: number;
  symbol: string;
  amount: number;
  targetId?: number;
  nftId?: number;
  luckyBoxId?: number;
  fromUserId?: number;
  toSymbol?: string;
  toAmount?: number;
  nftSaleId?: number;
}
