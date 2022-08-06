export enum ACTION_TARGET_TYPE {
  TOKEN = 'token',
  BED = 'bed',
  BED_BOX = 'bedbox',
  JEWEL = 'jewel',
  ITEM = 'item',
  LUCKY_BOX = 'luckybox',
}

export enum ACTION_TYPE {
  WITHDRAW_TOKEN = 'withdraw_token',
  WITHDRAW_NFT = 'withdraw_nft',
  DEPOSIT_TOKEN = 'deposit_token',
  DEPOSIT_NFT = 'deposit_nft',
  TRADE = 'TRADE',
  SELL = 'SELL',
  BUY = 'BUY',
  MINT = 'MINT',
  REPAIR = 'REPAIR',
  LEVEL_UP = 'LEVEL_UP',
  RECYCLING = 'RECYCLING',
  OPEN_LUCK_BOX = 'OPEN_LUCKY_BOX',
}

export interface ACTION_INSERT_TYPE_DTO {
  type: ACTION_TYPE | string;
  targetType: ACTION_TARGET_TYPE | string;
  userId: number;
  symbol: string;
  amount: string;
  tx?: string;
  tokenId?: string;
  contractAddress?: string;
  tokenAddress?: string;
  nftId?: number;
  luckyBoxId?: number;
  nftSaleId?: number;
}
