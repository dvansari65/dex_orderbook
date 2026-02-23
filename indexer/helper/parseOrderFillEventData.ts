import {OrderFillEventData} from "../types/events"

const parseOrderFillEvent = (event: any): OrderFillEventData | null => {
    try {
      const data = event?.data;
  
      if (!data) {
        console.error("parseOrderFillEvent: missing event data");
        return null;
      }
  
      const side: "bid" | "ask" = data?.side && "bid" in data.side ? "bid" : "ask";
  
      return {
        maker:             data.maker?.toString(),
        makerOrderId:      data.makerOrderId?.toNumber(),
        taker:             data.taker?.toString(),
        takerOrderId:      data.takerOrderId?.toNumber(),
        side,
        price:             data.price?.toNumber() / 1000,
        baseLotsFilled:    data.baseLotsFilled?.toNumber() / 1000,
        baseLotsRemaining: data.baseLotsRemaining?.toNumber() / 1000,
        timestamp:         data.timestamp?.toNumber(),
      };
    } catch (error) {
      console.error("parseOrderFillEvent: failed to parse", error);
      return null;
    }
  };

  export default parseOrderFillEvent