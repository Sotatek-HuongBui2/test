export const TYPE_CONTRACT = {
    BED: 'bed',
    JEWEL: 'jewel',
    ITEM: 'item',
    BED_BOX: 'bedbox'
}

export const NFT_CONTRACT = {
    [TYPE_CONTRACT.BED]: process.env.BED_CONTRACT,
    [TYPE_CONTRACT.BED_BOX]: process.env.BED_BOX_CONTRACT,
    [TYPE_CONTRACT.JEWEL]: process.env.JEWEL_CONTRACT,
    [TYPE_CONTRACT.ITEM]: process.env.ITEM_CONTRACT,
}

export const NFT_TYPE_SUPPORT = [
    TYPE_CONTRACT.BED,
    TYPE_CONTRACT.BED_BOX,
    TYPE_CONTRACT.JEWEL,
    TYPE_CONTRACT.ITEM
]