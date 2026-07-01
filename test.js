const matchedRow = { phone: "123", Password: "abc" };
const phoneCol = Object.keys(matchedRow).find(k => k.toLowerCase() === 'phone');
const passwordCol = Object.keys(matchedRow).find(k => k.toLowerCase() === 'password') || "password";
console.log({phoneCol, passwordCol});
