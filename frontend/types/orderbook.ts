/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/orderbook.json`.
 */
export type Orderbook = {
  "address": "2BRNRPFwJWjgRGV3xeeudGsi9mPBQHxLWFB6r3xpgxku",
  "metadata": {
    "name": "orderbook",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Created with Anchor"
  },
  "instructions": [
    {
      "name": "cancelOrder",
      "discriminator": [
        95,
        129,
        237,
        240,
        8,
        49,
        223,
        132
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
          "name": "asks",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  115,
                  107,
                  115
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
          "name": "bids",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  105,
                  100,
                  115
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
          "name": "owner",
          "signer": true,
          "relations": [
            "openOrder"
          ]
        }
      ],
      "args": [
        {
          "name": "orderId",
          "type": "u64"
        }
      ]
    },
    {
      "name": "consumeEvent",
      "discriminator": [
        223,
        103,
        141,
        133,
        189,
        106,
        201,
        113
      ],
      "accounts": [
        {
          "name": "market",
          "writable": true
        },
        {
          "name": "eventQueue",
          "writable": true
        },
        {
          "name": "baseVault",
          "writable": true
        },
        {
          "name": "quoteVault",
          "writable": true
        },
        {
          "name": "vaultSigner",
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
          "name": "takerBaseAccount",
          "writable": true
        },
        {
          "name": "takerQuoteAccount",
          "writable": true
        },
        {
          "name": "makerBaseAccount",
          "writable": true
        },
        {
          "name": "makerQuoteAccount",
          "writable": true
        },
        {
          "name": "crank",
          "signer": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": []
    },
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
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  105,
                  100,
                  115
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
          "name": "asks",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  115,
                  107,
                  115
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
      "name": "initializeOpenOrder",
      "discriminator": [
        138,
        205,
        26,
        73,
        82,
        35,
        90,
        212
      ],
      "accounts": [
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
          "name": "market",
          "writable": true
        },
        {
          "name": "owner",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "placeIocOrder",
      "discriminator": [
        99,
        220,
        219,
        190,
        132,
        253,
        111,
        233
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
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  115,
                  107,
                  115
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
          "name": "bids",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  105,
                  100,
                  115
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
          "name": "baseQty",
          "type": "u64"
        },
        {
          "name": "priceInRawUnits",
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
          "name": "clientOrderId",
          "type": "u64"
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
    },
    {
      "name": "placeLimitOrder",
      "discriminator": [
        108,
        176,
        33,
        186,
        146,
        229,
        1,
        197
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
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  115,
                  107,
                  115
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
          "name": "bids",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  105,
                  100,
                  115
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
    },
    {
      "name": "placePostOnlyOrder",
      "discriminator": [
        253,
        171,
        187,
        207,
        158,
        181,
        93,
        176
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
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  115,
                  107,
                  115
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
          "name": "bids",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  105,
                  100,
                  115
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
          "name": "baseQty",
          "type": "u64"
        },
        {
          "name": "priceInRawUnits",
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
          "name": "clientOrderId",
          "type": "u64"
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
    },
    {
      "name": "updateOpenOrders",
      "discriminator": [
        37,
        146,
        64,
        218,
        230,
        254,
        17,
        142
      ],
      "accounts": [
        {
          "name": "takerOpenOrder",
          "writable": true
        },
        {
          "name": "makerOpenOrder",
          "writable": true
        },
        {
          "name": "market",
          "writable": true
        }
      ],
      "args": [
        {
          "name": "priceInQuoteLots",
          "type": "u64"
        },
        {
          "name": "quantityInBaseLots",
          "type": "u64"
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
      "name": "feeCollectedEvent",
      "discriminator": [
        142,
        253,
        94,
        133,
        187,
        191,
        46,
        40
      ]
    },
    {
      "name": "orderCancelledEvent",
      "discriminator": [
        200,
        73,
        179,
        145,
        247,
        176,
        10,
        101
      ]
    },
    {
      "name": "orderEvictedEvent",
      "discriminator": [
        241,
        47,
        243,
        215,
        191,
        253,
        192,
        4
      ]
    },
    {
      "name": "orderExpiredEvent",
      "discriminator": [
        150,
        3,
        200,
        97,
        178,
        224,
        156,
        9
      ]
    },
    {
      "name": "orderFillEvent",
      "discriminator": [
        192,
        9,
        71,
        11,
        130,
        252,
        155,
        178
      ]
    },
    {
      "name": "orderPartialFillEvent",
      "discriminator": [
        233,
        153,
        41,
        109,
        134,
        13,
        170,
        25
      ]
    },
    {
      "name": "orderPlacedEvent",
      "discriminator": [
        245,
        198,
        202,
        247,
        110,
        231,
        254,
        156
      ]
    },
    {
      "name": "orderReducedEvent",
      "discriminator": [
        61,
        186,
        154,
        129,
        69,
        99,
        41,
        184
      ]
    },
    {
      "name": "timeInForceEvent",
      "discriminator": [
        148,
        0,
        137,
        23,
        53,
        217,
        183,
        99
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "marketActiveError",
      "msg": "Market is paused!"
    },
    {
      "code": 6001,
      "name": "marketOrderSizeError",
      "msg": "Max base size should be greater than minimum order size!"
    },
    {
      "code": 6002,
      "name": "mathOverflow",
      "msg": "Value overflowed!"
    },
    {
      "code": 6003,
      "name": "noOrders",
      "msg": "No orders"
    },
    {
      "code": 6004,
      "name": "orderIdOverFlow",
      "msg": "Order id overflow!"
    },
    {
      "code": 6005,
      "name": "insufficientQuoteBalance",
      "msg": "insufficient balance!"
    },
    {
      "code": 6006,
      "name": "insufficientBaseBalance",
      "msg": "insufficient balance!"
    },
    {
      "code": 6007,
      "name": "invalidTokenAccountOwner",
      "msg": "Invalid token owner!"
    },
    {
      "code": 6008,
      "name": "invalidTokenMint",
      "msg": "Invalid token Mint!"
    },
    {
      "code": 6009,
      "name": "destinationVaultUninitialized",
      "msg": "Destination vault is uninitialise!"
    },
    {
      "code": 6010,
      "name": "invalidMarketAccount",
      "msg": "Invalid market account!"
    },
    {
      "code": 6011,
      "name": "invalidPrice",
      "msg": "Invalid Quote Price!"
    },
    {
      "code": 6012,
      "name": "invalidBaseQty",
      "msg": "Invalid base quantity!"
    },
    {
      "code": 6013,
      "name": "invalidTakerAccount",
      "msg": "Invalid taker token account!"
    },
    {
      "code": 6014,
      "name": "invalidMakerAccount",
      "msg": "Invalid maker token account!"
    },
    {
      "code": 6015,
      "name": "invalidOpenOrders",
      "msg": "Invalid open orders account!"
    },
    {
      "code": 6016,
      "name": "invalidEventQueue",
      "msg": "Invalid event queue account!"
    },
    {
      "code": 6017,
      "name": "invalidVault",
      "msg": "Invalid vault account!"
    },
    {
      "code": 6018,
      "name": "eventQueueUnderflow",
      "msg": "Event queue underflow!"
    },
    {
      "code": 6019,
      "name": "eventQueueEmpty",
      "msg": "There is no events in Event queue!"
    },
    {
      "code": 6020,
      "name": "seqOverflow",
      "msg": "Sequence over flow!"
    },
    {
      "code": 6021,
      "name": "missingMakerOpenOrder",
      "msg": "Maker order missing!"
    }
  ],
  "types": [
    {
      "name": "eventQueue",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "head",
            "type": "u32"
          },
          {
            "name": "tail",
            "type": "u32"
          },
          {
            "name": "count",
            "type": "u32"
          },
          {
            "name": "events",
            "type": {
              "vec": {
                "defined": {
                  "name": "queueEvent"
                }
              }
            }
          }
        ]
      }
    },
    {
      "name": "eventType",
      "repr": {
        "kind": "rust"
      },
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "place"
          },
          {
            "name": "fill"
          },
          {
            "name": "partialFill"
          },
          {
            "name": "cancel"
          },
          {
            "name": "reduce"
          },
          {
            "name": "evict"
          },
          {
            "name": "expire"
          },
          {
            "name": "feeCollected"
          },
          {
            "name": "timeInForce"
          }
        ]
      }
    },
    {
      "name": "feeCollectedEvent",
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
            "name": "orderId",
            "type": "u64"
          },
          {
            "name": "feesCollectedInQuoteLots",
            "type": "u64"
          },
          {
            "name": "timestamp",
            "type": "i64"
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
            "name": "globalSeq",
            "type": "u64"
          },
          {
            "name": "nextOrderId",
            "type": "u64"
          },
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
            "name": "orderId",
            "type": "u64"
          },
          {
            "name": "orderStatus",
            "type": {
              "defined": {
                "name": "orderStatus"
              }
            }
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
            "type": "u64"
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
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "quantity",
            "type": "u64"
          },
          {
            "name": "clientOrderId",
            "type": "u64"
          },
          {
            "name": "orderStatus",
            "type": {
              "defined": {
                "name": "orderStatus"
              }
            }
          }
        ]
      }
    },
    {
      "name": "orderCancelledEvent",
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
            "name": "orderId",
            "type": "u64"
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
            "name": "timestamp",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "orderEvictedEvent",
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
            "name": "orderId",
            "type": "u64"
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
            "name": "baseLotsEvicted",
            "type": "u64"
          },
          {
            "name": "timestamp",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "orderExpiredEvent",
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
            "name": "orderId",
            "type": "u64"
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
            "name": "baseLotsRemoved",
            "type": "u64"
          },
          {
            "name": "timestamp",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "orderFillEvent",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "maker",
            "type": "pubkey"
          },
          {
            "name": "makerOrderId",
            "type": "u64"
          },
          {
            "name": "taker",
            "type": "pubkey"
          },
          {
            "name": "takerOrderId",
            "type": "u64"
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
            "name": "baseLotsFilled",
            "type": "u64"
          },
          {
            "name": "baseLotsRemaining",
            "type": "u64"
          },
          {
            "name": "timestamp",
            "type": "i64"
          },
          {
            "name": "marketPubkey",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "orderPartialFillEvent",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "maker",
            "type": "pubkey"
          },
          {
            "name": "makerOrderId",
            "type": "u64"
          },
          {
            "name": "taker",
            "type": "pubkey"
          },
          {
            "name": "takerOrderId",
            "type": "u64"
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
            "name": "baseLotsFilled",
            "type": "u64"
          },
          {
            "name": "baseLotsRemaining",
            "type": "u64"
          },
          {
            "name": "timestamp",
            "type": "i64"
          },
          {
            "name": "marketPubkey",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "orderPlacedEvent",
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
            "name": "orderId",
            "type": "u64"
          },
          {
            "name": "clientOrderId",
            "type": "u64"
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
            "name": "baseLots",
            "type": "u64"
          },
          {
            "name": "timestamp",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "orderReducedEvent",
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
            "name": "orderId",
            "type": "u64"
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
            "name": "baseLotsRemoved",
            "type": "u64"
          },
          {
            "name": "baseLotsRemaining",
            "type": "u64"
          },
          {
            "name": "timestamp",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "orderStatus",
      "repr": {
        "kind": "rust"
      },
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "fill"
          },
          {
            "name": "partialFill"
          },
          {
            "name": "open"
          },
          {
            "name": "cancel"
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
      "name": "queueEvent",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "globalSeq",
            "type": "u64"
          },
          {
            "name": "makerOrderId",
            "type": "u64"
          },
          {
            "name": "eventType",
            "type": {
              "defined": {
                "name": "eventType"
              }
            }
          },
          {
            "name": "orderId",
            "type": "u64"
          },
          {
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "counterparty",
            "type": "pubkey"
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
            "name": "baseQuantity",
            "type": "u64"
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
            "name": "marketPubkey",
            "type": "pubkey"
          },
          {
            "name": "takerRemainingQty",
            "type": "u64"
          },
          {
            "name": "makerRemainingQty",
            "type": "u64"
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
    },
    {
      "name": "timeInForceEvent",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "market",
            "type": "pubkey"
          },
          {
            "name": "orderId",
            "type": "u64"
          },
          {
            "name": "lastValidSlot",
            "type": "u64"
          },
          {
            "name": "lastValidUnixTimestampInSeconds",
            "type": "u64"
          }
        ]
      }
    }
  ]
};
