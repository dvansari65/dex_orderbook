
  // Convert UI values to proper token amounts with decimals
  export const convertToTokenAmount = (value: string, decimals: number = 6): number => {
    if (!value || isNaN(parseFloat(value))) return 0;
    return Math.floor(parseFloat(value) * Math.pow(10, decimals));
  }