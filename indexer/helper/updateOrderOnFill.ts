import prisma from "../lib/prisma";

const deriveStatus = (filledLots: number, baseLots: number): string => {
    if (filledLots >= baseLots) return "filled";
    if (filledLots > 0) return "partial";
    return "open";
  };
  
  // ─── UPDATE MAKER + TAKER ORDERS ─────────────────────────────────────────────
  
  export const updateOrdersOnFill = async (
    makerOrderId: string,
    takerOrderId: string,
    baseLotsFilled: number  // raw number from event (before division)
  ): Promise<void> => {
   try {
    await prisma.$transaction(async (tx) => {
  
        // ── MAKER ────────────────────────────────────────────────────────────────
        const makerOrder = await tx.order.findUnique({
          where: { orderId: makerOrderId },
        });
    
        if (makerOrder) {
          const makerNewFilled = makerOrder.filledLots + baseLotsFilled;
          const makerStatus = deriveStatus(makerNewFilled, makerOrder.baseLots);
    
          await tx.order.update({
            where: { orderId: makerOrderId },
            data: {
              filledLots: makerNewFilled,
              status: makerStatus,
            },
          });
    
          console.log(`✅ Maker order ${makerOrderId} | filledLots: ${makerNewFilled}/${makerOrder.baseLots} | status: ${makerStatus}`);
        } else {
          console.warn(`⚠️ Maker order not found: ${makerOrderId}`);
        }
    
        // ── TAKER ────────────────────────────────────────────────────────────────
        const takerOrder = await tx.order.findUnique({
          where: { orderId: takerOrderId },
        });
    
        if (takerOrder) {
          const takerNewFilled = takerOrder.filledLots + baseLotsFilled;
          const takerStatus = deriveStatus(takerNewFilled, takerOrder.baseLots);
    
          await tx.order.update({
            where: { orderId: takerOrderId },
            data: {
              filledLots: takerNewFilled,
              status: takerStatus,
            },
          });
    
          console.log(`✅ Taker order ${takerOrderId} | filledLots: ${takerNewFilled}/${takerOrder.baseLots} | status: ${takerStatus}`);
        } else {
          console.warn(`⚠️ Taker order not found: ${takerOrderId}`);
        }
      });
   } catch (error) {
        console.error("error:",error)
        throw error
   }
  };