import prisma from "../lib/prisma";

export const getRecentTrades = async ()=> {
  try {
    const recentTrades = await prisma.trade.findMany({
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