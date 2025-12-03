/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/orderbook.json`.
 */
export type Orderbook = {
  "address": "JAVuBXeBZqXNtS73azhBDAoYaaAFfo4gWXoZe2e7Jf8H",
  "metadata": {
    "name": "orderbook",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Created with Anchor"
  },
  "instructions": [
    {
      "name": "initialiseMarket",
      "discriminator": [
        164,
        190,
        47,
        190,
        198,
        116,
        201,
        190
      ],
      "accounts": [
        {
          "name": "market",
          "writable": true,
          "signer": true
        },
        {
          "name": "bids",
          "writable": true,
          "signer": true
        },
        {
          "name": "asks",
          "writable": true,
          "signer": true
        },
        {
          "name": "eventQueue",
          "writable": true,
          "signer": true
        },
        {
          "name": "baseVault",
          "writable": true,
          "signer": true
        },
        {
          "name": "quoteVault",
          "writable": true,
          "signer": true
        },
        {
          "name": "vaultSigner",
          "docs": [
            "This is a PDA used only as the authority for the token vaults.",
            "It holds no data, is never read or written, and is only used for signing.",
            "Safe because Anchor verifies the PDA seeds & bump."
          ],
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116,
                  95,
                  115,
                  105,
                  103,
                  110,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "market"
              }
            ]
          }
        },
        {
          "name": "admin",
          "writable": true,
          "signer": true
        },
        {
          "name": "baseMint"
        },
        {
          "name": "quoteMint"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": [
        {
          "name": "baseLotSize",
          "type": "u64"
        },
        {
          "name": "quoteLotSize",
          "type": "u64"
        },
        {
          "name": "makerFeesBps",
          "type": "u64"
        },
        {
          "name": "takerFeesBps",
          "type": "u64"
        }
      ]
    },
    {
      "name": "placeOrder",
      "discriminator": [
        51,
        194,
        155,
        175,
        109,
        130,
        96,
        106
      ],
      "accounts": [
        {
          "name": "market",
          "writable": true,
          "relations": [
            "openOrder"
          ]
        },
        {
          "name": "asks",
          "writable": true
        },
        {
          "name": "bids",
          "writable": true
        },
        {
          "name": "openOrder",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  111,
                  112,
                  101,
                  110,
                  95,
                  111,
                  114,
                  100,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "market"
              },
              {
                "kind": "account",
                "path": "owner"
              }
            ]
          }
        },
        {
          "name": "eventQueue",
          "writable": true
        },
        {
          "name": "quoteVault",
          "writable": true
        },
        {
          "name": "baseVault",
          "writable": true
        },
        {
          "name": "userBaseVault",
          "writable": true
        },
        {
          "name": "userQuoteVault",
          "writable": true
        },
        {
          "name": "owner",
          "signer": true,
          "relations": [
            "openOrder"
          ]
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": [
        {
          "name": "maxBaseSize",
          "type": "u64"
        },
        {
          "name": "clientOrderId",
          "type": "u64"
        },
        {
          "name": "price",
          "type": "u64"
        },
        {
          "name": "orderType",
          "type": {
            "defined": {
              "name": "orderType"
            }
          }
        },
        {
          "name": "side",
          "type": {
            "defined": {
              "name": "side"
            }
          }
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "eventQueue",
      "discriminator": [
        41,
        208,
        116,
        209,
        173,
        116,
        141,
        68
      ]
    },
    {
      "name": "market",
      "discriminator": [
        219,
        190,
        213,
        55,
        0,
        227,
        198,
        154
      ]
    },
    {
      "name": "openOrders",
      "discriminator": [
        139,
        166,
        123,
        206,
        111,
        2,
        116,
        33
      ]
    },
    {
      "name": "slab",
      "discriminator": [
        94,
        207,
        123,
        251,
        151,
        56,
        91,
        216
      ]
    }
  ],
  "events": [
    {
      "name": "orderFilledEvent",
      "discriminator": [
        218,
        97,
        153,
        209,
        56,
        56,
        251,
        133
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "balanceError",
      "msg": "Insufficient balance"
    },
    {
      "code": 6001,
      "name": "orderbookFull",
      "msg": "Order book full!"
    },
    {
      "code": 6002,
      "name": "orderNotFound",
      "msg": "order not found!"
    },
    {
      "code": 6003,
      "name": "orderFull",
      "msg": "Orders exceeded!"
    }
  ],
  "types": [
    {
      "name": "event",
      "repr": {
        "kind": "c"
      },
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "orderId",
            "type": "u64"
          },
          {
            "name": "eventType",
            "type": "u8"
          },
          {
            "name": "price",
            "type": "u64"
          },
          {
            "name": "quantity",
            "type": "u64"
          },
          {
            "name": "maker",
            "type": "pubkey"
          },
          {
            "name": "taker",
            "type": "pubkey"
          },
          {
            "name": "timestamp",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "eventQueue",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "tail",
            "type": "u32"
          },
          {
            "name": "header",
            "type": "u32"
          },
          {
            "name": "count",
            "type": "u32"
          },
          {
            "name": "capacity",
            "type": "u32"
          },
          {
            "name": "events",
            "type": {
              "vec": {
                "defined": {
                  "name": "event"
                }
              }
            }
          }
        ]
      }
    },
    {
      "name": "market",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "baseMint",
            "type": "pubkey"
          },
          {
            "name": "quoteMint",
            "type": "pubkey"
          },
          {
            "name": "baseVault",
            "type": "pubkey"
          },
          {
            "name": "quoteVault",
            "type": "pubkey"
          },
          {
            "name": "bids",
            "type": "pubkey"
          },
          {
            "name": "asks",
            "type": "pubkey"
          },
          {
            "name": "eventQueue",
            "type": "pubkey"
          },
          {
            "name": "baseLotSize",
            "type": "u64"
          },
          {
            "name": "quoteLotSize",
            "type": "u64"
          },
          {
            "name": "makerFeesBps",
            "type": "u64"
          },
          {
            "name": "takerFeesBps",
            "type": "u64"
          },
          {
            "name": "admin",
            "type": "pubkey"
          },
          {
            "name": "vaultSignerNonce",
            "type": "u8"
          },
          {
            "name": "marketStatus",
            "type": "u8"
          },
          {
            "name": "minOrderSize",
            "type": "u64"
          },
          {
            "name": "maxOrdersPerUser",
            "type": "u16"
          },
          {
            "name": "padding",
            "type": {
              "array": [
                "u8",
                64
              ]
            }
          }
        ]
      }
    },
    {
      "name": "node",
      "repr": {
        "kind": "c"
      },
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "price",
            "type": "u64"
          },
          {
            "name": "quantity",
            "type": "u64"
          },
          {
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "clientOrderId",
            "type": "u64"
          },
          {
            "name": "timestamp",
            "type": "i64"
          },
          {
            "name": "next",
            "type": "u32"
          },
          {
            "name": "prev",
            "type": "u32"
          }
        ]
      }
    },
    {
      "name": "openOrders",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "market",
            "type": "pubkey"
          },
          {
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "baseFree",
            "type": "u64"
          },
          {
            "name": "baseLocked",
            "type": "u64"
          },
          {
            "name": "quoteFree",
            "type": "u64"
          },
          {
            "name": "quoteLocked",
            "type": "u64"
          },
          {
            "name": "orders",
            "type": {
              "vec": {
                "defined": {
                  "name": "order"
                }
              }
            }
          },
          {
            "name": "ordersCount",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "order",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "orderType",
            "type": {
              "defined": {
                "name": "orderType"
              }
            }
          },
          {
            "name": "orderId",
            "type": "u128"
          },
          {
            "name": "side",
            "type": {
              "defined": {
                "name": "side"
              }
            }
          },
          {
            "name": "price",
            "type": "u64"
          },
          {
            "name": "quantity",
            "type": "u64"
          },
          {
            "name": "clientOrderId",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "orderFilledEvent",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "maker",
            "type": "pubkey"
          },
          {
            "name": "taker",
            "type": "pubkey"
          },
          {
            "name": "price",
            "type": "u64"
          },
          {
            "name": "quantity",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "orderType",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "limit"
          },
          {
            "name": "immediateOrCancel"
          },
          {
            "name": "postOnly"
          }
        ]
      }
    },
    {
      "name": "side",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "bid"
          },
          {
            "name": "ask"
          }
        ]
      }
    },
    {
      "name": "slab",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "headIndex",
            "type": "u32"
          },
          {
            "name": "freeListLen",
            "type": "u32"
          },
          {
            "name": "leafCount",
            "type": "u32"
          },
          {
            "name": "nodes",
            "type": {
              "vec": {
                "defined": {
                  "name": "node"
                }
              }
            }
          }
        ]
      }
    }
  ]
};
