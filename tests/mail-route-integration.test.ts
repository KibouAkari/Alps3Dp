import assert from "node:assert/strict";
import test from "node:test";
import Stripe from "stripe";

type User = { id: string; email: string; passwordHash: string; firstName: string|null; lastName: string|null; username: string|null; avatarUrl: null; salutation: null; role: "CUSTOMER"; emailVerifiedAt: Date|null };
type Token = { id: string; userId: string; tokenHash: string; usedAt: Date|null; expiresAt: Date };
type Session = { userId: string; tokenHash: string; expiresAt: Date };
type Mail = { from: string; to: string; subject: string; html: string; text: string };
const users: User[] = [];
const verifyTokens: Token[] = [];
const resetTokens: Token[] = [];
const sessions: Session[] = [];
const messages: Mail[] = [];
let counter = 0;
let order: Record<string, any> | null = null;
const originalFetch = globalThis.fetch;
const empty = () => ({ count: 0 });

function tokenMatches(record: Token, where: Record<string,any>) {
  return record.tokenHash === where.tokenHash &&
    (where.usedAt === undefined || record.usedAt === where.usedAt) &&
    (!where.expiresAt?.gt || record.expiresAt > where.expiresAt.gt);
}
const testDb: any = {
  user: {
    findUnique: async ({where}: any) => users.find(u => where.email ? u.email === where.email : u.id === where.id) || null,
    findFirst: async ({where}: any) => users.find(u => u.username && u.username === where.username) || null,
    create: async ({data}: any) => {
      const u: User = { id: `test-user-${++counter}`, emailVerifiedAt: null, role:"CUSTOMER", avatarUrl:null, salutation:null, username:null, firstName:null, lastName:null, ...data };
      users.push(u); return u;
    },
    update: async ({where,data}: any) => {
      const u=users.find(u=>u.id===where.id);
      if(!u)throw Error("test: missing user");Object.assign(u,data);return u;
    },
  },
  emailVerificationToken: {
    create: async ({data}:any) => {const token:Token={id:`vt_${++counter}`,usedAt:null,...data};verifyTokens.push(token);return token;},
    findFirst: async ({where}:any) => verifyTokens.find(t=>tokenMatches(t,where)) || null,
    update: async ({where,data}:any) => {const token=verifyTokens.find(t=>t.id===where.id);Object.assign(token!,data);return token;},
    deleteMany: async ({where}:any) => {
      let removed=0;
      for(let i=verifyTokens.length-1;i>=0;i--) if(verifyTokens[i].userId===where.userId){verifyTokens.splice(i,1);removed++}
      return {count:removed};
    },
  },
  passwordResetToken: {
    create: async ({data}:any) => {const token:Token={id:`rt_${++counter}`,usedAt:null,...data};resetTokens.push(token);return token;},
    findFirst: async ({where}:any) => resetTokens.find(t=>tokenMatches(t,where)) || null,
    updateMany: async ({where,data}:any) => {
      const token=resetTokens.find(t=>t.id===where.id&&
        (where.usedAt===undefined||t.usedAt===where.usedAt)&&
        (!where.expiresAt?.gt||t.expiresAt>where.expiresAt.gt));
      if(!token)return {count:0};Object.assign(token,data);return {count:1};
    },
    deleteMany: async ({where}:any) => {
      let removed=0;
      for(let i=resetTokens.length-1;i>=0;i--)
        if(resetTokens[i].userId===where.userId&&(where.usedAt===undefined||resetTokens[i].usedAt===where.usedAt)){
          resetTokens.splice(i,1);removed++;
        }
      return {count:removed};
    },
  },
  userSession: {
    create: async ({data}:any) => {sessions.push(data);return data;},
    findFirst: async ({where}:any) => {
      const s=sessions.find(s=>s.tokenHash===where.tokenHash&&s.expiresAt>where.expiresAt.gt);
      return s ? {...s,user:users.find(u=>u.id===s.userId)} : null;
    },
    deleteMany: async ({where}:any) => {
      let removed=0;
      for(let i=sessions.length-1;i>=0;i--)
        if(sessions[i].userId===where.userId){sessions.splice(i,1);removed++;}
      return {count:removed};
    },
  },
  order: {
    findUnique: async ({where}:any) => order?.id===where.id ? order : null,
    updateMany: async ({where,data}:any) => {
      if(!order||order.id!==where.id||!where.status?.in?.includes(order.status))return {count:0};
      Object.assign(order,data);return {count:1};
    },
  },
  cart:{findUnique:async()=>null},
  cartItem:{deleteMany:async()=>empty()},
  $transaction: async (steps:any) => typeof steps==="function"
    ? steps(testDb) : Promise.all(steps),
};

// db.ts supports global.prisma in development/test; no database connections.
(globalThis as unknown as {prisma:unknown}).prisma=testDb;
process.env.DATABASE_URL="postgresql://not-connected:fake@127.0.0.1:5432/test";
process.env.RESEND_API_KEY="re_FAKE_TEST_NEVER_REAL";
process.env.MAIL_PROVIDER="resend";
process.env.MAIL_FROM="Alps3Dp <order@alps3dp.ch>";
process.env.MAIL_SUPPORT_EMAIL="support@example.test";
process.env.ADMIN_ORDER_EMAIL="owner@example.test";
process.env.NEXT_PUBLIC_APP_URL="https://www.alps3dp.ch";
process.env.STRIPE_SECRET_KEY="sk_test_SAFELY_FAKE";
process.env.STRIPE_WEBHOOK_SECRET="whsec_local_fake_test";

globalThis.fetch = (async (input: RequestInfo|URL, init?:RequestInit) => {
  const url=typeof input==="string"?input:input instanceof URL?input.href:input.url;
  assert.equal(url, "https://api.resend.com/emails");
  const body=init?.body || (input instanceof Request ? await input.text():undefined);
  assert.ok(body,"Test intercepted email payload is required");
  messages.push(JSON.parse(String(body)) as Mail);
  return new Response(JSON.stringify({id:`mock_email_${messages.length}`}),{
    status:200,headers:{"content-type":"application/json"}
  });
}) as typeof fetch;

let routes: Record<string,any>={};
test.before(async()=>{
  const modules=await Promise.all([
    import("../src/app/api/auth/register/route"),
    import("../src/app/api/auth/login/route"),
    import("../src/app/api/auth/verify-email/route"),
    import("../src/app/api/auth/resend-verification/route"),
    import("../src/app/api/password/forgot/route"),
    import("../src/app/api/password/reset/route"),
    import("../src/app/api/contact/route"),
    import("../src/app/api/webhooks/payment/route"),
    import("../src/app/api/account/email/route"),
  ]);
  const keys=["register","login","verify","resend","forgot","reset","contact","webhook","changeEmail"];
  keys.forEach((key,i)=>{routes[key]=modules[i];});
});
test.after(()=>{globalThis.fetch=originalFetch;delete (globalThis as unknown as {prisma?:unknown}).prisma;});

const post=(endpoint:string,body:unknown,ip:string) =>
  new Request("https://www.alps3dp.ch"+endpoint,{
    method:"POST",
    headers:{"content-type":"application/json","x-forwarded-for":ip},
    body:JSON.stringify(body),
  });
const tokenFromMail=(message: Mail,pattern:RegExp) => {
  const found=message.html.match(pattern);
  assert.ok(found,"Token URL not present in mail");return found[1];
};

test("Registration, resend verification, link consumption, email change and re-verification",async()=>{
  const result=await routes.register.POST(post("/api/auth/register",{
    firstName:"Lara",lastName:"Mailtest",email:"test1@example.test",
    password:"CorrectPassword123",
  },"192.0.2.13"));
  assert.equal(result.status,200);
  assert.equal(users.length,1);
  assert.equal(messages.length,1);
  assert.match(messages[0].subject,/Willkommen/);
  assert.ok(messages[0].text);
  const originalToken=tokenFromMail(messages[0],/api\/auth\/verify-email\?token=([a-f0-9]+)/);

  // Session is created during signup. A lost verification email can be safely
  // reissued to the authenticated user, without changing user data.
  const cookie=result.headers.get("set-cookie");
  assert.ok(cookie);
  const resendRequest=new Request("https://www.alps3dp.ch/api/auth/resend-verification",{
    method:"POST",headers:{"cookie":cookie!,"x-forwarded-for":"192.0.2.16"},
  });
  const resend=await routes.resend.POST(resendRequest);
  assert.equal(resend.status,200);
  assert.equal(messages.length,2);
  const secondToken=tokenFromMail(messages[1],/api\/auth\/verify-email\?token=([a-f0-9]+)/);
  assert.notEqual(secondToken,originalToken);
  const invalid=await routes.verify.GET(new Request(
    "https://www.alps3dp.ch/api/auth/verify-email?token="+originalToken));
  assert.match(invalid.headers.get("location")||"",/verified=invalid/);
  const verified=await routes.verify.GET(new Request(
    "https://www.alps3dp.ch/api/auth/verify-email?token="+secondToken));
  assert.match(verified.headers.get("location")||"",/verified=ok/);
  assert.ok(users[0].emailVerifiedAt);
  const replay=await routes.verify.GET(new Request(
    "https://www.alps3dp.ch/api/auth/verify-email?token="+secondToken));
  assert.match(replay.headers.get("location")||"",/verified=invalid/);

  // Password authenticated email change revokes previous user verification
  // tokens and creates an unverified new address with a new link.
  const change=await routes.changeEmail.PATCH(new Request("https://www.alps3dp.ch/api/account/email",{
    method:"PATCH",headers:{"content-type":"application/json","cookie":cookie!,"x-forwarded-for":"192.0.2.18"},
    body:JSON.stringify({newEmail:"changed@example.test",currentPassword:"CorrectPassword123"}),
  }));
  assert.equal(change.status,200);
  assert.equal(users[0].email,"changed@example.test");
  assert.equal(users[0].emailVerifiedAt,null);
  assert.equal(messages.at(-1)?.to,"changed@example.test");
  const thirdToken=tokenFromMail(messages.at(-1)!,/api\/auth\/verify-email\?token=([a-f0-9]+)/);
  assert.notEqual(thirdToken,secondToken);
  const changedVerified=await routes.verify.GET(new Request(
    "https://www.alps3dp.ch/api/auth/verify-email?token="+thirdToken));
  assert.match(changedVerified.headers.get("location")||"",/verified=ok/);
  assert.ok(users[0].emailVerifiedAt);
});

test("Reset mails, invalidating older tokens, one-time reset, and session invalidation",async()=>{
  messages.length=0;
  const first=await routes.forgot.POST(post("/api/password/forgot",{email:"changed@example.test"},"192.0.2.20"));
  assert.equal(first.status,200);
  assert.equal(messages.length,1);
  const firstToken=tokenFromMail(messages[0],/auth\/reset-password\?token=([a-f0-9]+)/);
  const second=await routes.forgot.POST(post("/api/password/forgot",{email:"changed@example.test"},"192.0.2.21"));
  assert.equal(second.status,200);
  const newer=tokenFromMail(messages[1],/auth\/reset-password\?token=([a-f0-9]+)/);
  assert.notEqual(firstToken,newer);
  const invalid=await routes.reset.POST(post("/api/password/reset",{
    token:firstToken,password:"MyNewPassword123",
  },"192.0.2.22"));
  assert.equal(invalid.status,400);

  const before=sessions.length;
  assert.ok(before>0);
  const accepted=await routes.reset.POST(post("/api/password/reset",{
    token:newer,password:"MyNewPassword123",
  },"192.0.2.23"));
  assert.equal(accepted.status,200);
  assert.equal(sessions.length,0,"All old sessions must be invalidated");
  const replay=await routes.reset.POST(post("/api/password/reset",{
    token:newer,password:"AnotherPassword123",
  },"192.0.2.24"));
  assert.equal(replay.status,400);
  const bad=await routes.login.POST(post("/api/auth/login",{
    email:"changed@example.test",password:"CorrectPassword123",
  },"192.0.2.25"));
  assert.equal(bad.status,401);
  const good=await routes.login.POST(post("/api/auth/login",{
    email:"changed@example.test",password:"MyNewPassword123",
  },"192.0.2.26"));
  assert.equal(good.status,200);
  assert.equal(messages.filter(m=>m.subject.includes("Willkommen")).length,0,
    "Login must not repeat an earlier registration welcome email");
  assert.ok(messages.some(m=>m.subject.includes("Neue Anmeldung")));
});

test("Support form generates both owner enquiry and customer acknowledgment",async()=>{
  messages.length=0;
  const result=await routes.contact.POST(post("/api/contact",{
    firstName:"Lara",lastName:"Mailtest",email:"changed@example.test",
    subject:"Frage zum Shop",message:"Könnt ihr mir helfen?",
  },"192.0.2.27"));
  assert.equal(result.status,200);
  assert.deepEqual(messages.map(m=>m.to),["support@example.test","changed@example.test"]);
});

test("Signed Stripe paid event sends two order emails and replay is deduplicated",async()=>{
  messages.length=0;
  order={
    id:"test-order-123",status:"PENDING",totalCents:4990,orderNumber:123,
    customerEmail:"buyer@example.test",customerName:"Lara",
    subtotalCents:4990,shippingCents:0,paymentMethod:"CARD",
    createdAt:new Date("2026-11-25T10:00:00Z"),userId:users[0].id,
    shippingAddress1:"Testweg 2",shippingAddress2:null,
    shippingZip:"8000",shippingCity:"Zürich",shippingCountry:"CH",
    items:[{product:{title:"3D Teil"},unitCents:4990,quantity:1}],
  };
  const stripe=new Stripe(process.env.STRIPE_SECRET_KEY!,{apiVersion:"2025-08-27.basil"});
  const event={
    id:"evt_test_123",object:"event",type:"checkout.session.completed",
    data:{object:{id:"cs_test_123",payment_status:"paid",
      metadata:{orderId:"test-order-123"},currency:"chf",amount_total:4990}},
  };
  const payload=JSON.stringify(event);
  const signature=stripe.webhooks.generateTestHeaderString({
    payload,secret:process.env.STRIPE_WEBHOOK_SECRET!,
  });
  const request=()=>new Request("https://www.alps3dp.ch/api/webhooks/payment",{
    method:"POST",headers:{"stripe-signature":signature},body:payload,
  });
  const first=await routes.webhook.POST(request());
  assert.equal(first.status,200);
  assert.equal(order.status,"PAID");
  assert.deepEqual(messages.map(m=>m.to),["buyer@example.test","owner@example.test"]);
  const second=await routes.webhook.POST(request());
  assert.equal(second.status,200);
  assert.equal((await second.json()).deduplicated,true);
  assert.equal(messages.length,2);
});
