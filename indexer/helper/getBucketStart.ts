


export const getBucketStart = (date:Date,resolution:string)=>{
    const d = new Date(date) 
    switch (resolution){
        case "1m":
            d.setSeconds(0,0);
            return d
        case "5m":
            d.setSeconds(0,0);
            d.setMinutes(Math.floor(d.getMinutes()/5)*5);
            return d
        case "1h":
            d.setMinutes(0,0,0);
            return d
        case "1d":
            d.setHours(0,0,0);
            return d
        default:
            throw new Error(`Unknown resolution:${resolution}`)
    }
}