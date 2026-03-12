import { OrderStatus } from "../generated/prisma/enums";
import prisma from "../lib/prisma";

const deriveStatus = (filledLots: number, baseLots: number): OrderStatus => {
    if (filledLots >= baseLots) return OrderStatus.filled;
    if (filledLots > 0) return OrderStatus.Partial;
    return OrderStatus.Open;
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

  export const updateOnSettle = async (orderId:number | null):Promise<void>=>{
    try {
      if(!orderId){
        console.warn("Order ID not found!");
        return;
      }
      console.log("order id:",String(orderId));
      const updatedOrder = await prisma.order.update({
        where:{
          orderId:String(orderId)
        },
        data:{
          status:OrderStatus.Settled,
          settledAt:new Date()
        }
      })

    } catch (error) {
      console.error("error:",error)
      return
    }
  }