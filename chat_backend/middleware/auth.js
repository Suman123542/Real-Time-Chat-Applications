import User from "../models/User.js";
import jet from "jsonwebtoken";
//middle to protct route

export const protectRoute = async(req, res, next) => {
    try {
        let token = req.headers.token || req.headers.authorization;
        if (!token) {
            return res.status(401).json({message: "Unauthorized"});
        }
        if (typeof token === "string" && token.startsWith("Bearer ")) {
            token = token.slice(7);
        }
        const decoded = jet.verify(token, process.env.JWT_SECRET);
        const userId = decoded.userId || decoded.id;
        const user = await User.findById(userId).select("-password");
        if(!user){
            return res.status(401).json({message: "Unauthorized"});
        }
        req.user = user;
        next();
    } catch (error) {
        console.log(error);
        return res.status(401).json({message: "Unauthorized"});
}
}


