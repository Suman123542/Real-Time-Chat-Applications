import jetwebtoken from "jsonwebtoken";


// Function to generate a JWT token for a user
export const generateToken = (userId) => {
    const token = jetwebtoken.sign({id: userId}, process.env.JWT_SECRET, {expiresIn: "7d"});
    return token;
}