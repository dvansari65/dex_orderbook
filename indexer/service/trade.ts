import prisma from "../lib/prisma";

export const getRecentTrades = async (marketKey:string)=> {
  try {
    const recentTrades = await prisma.trade.findMany({
      where:{
        marketAddress:marketKey
      },
      take: 15,
      orderBy: {
        timestamp: "desc",
      },
    });
    return recentTrades
  } catch (error) {
    console.error(error);
    return [];
  }
};