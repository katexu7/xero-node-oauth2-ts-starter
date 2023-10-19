require('dotenv').config();
import express from 'express';
import cors from 'cors';
import { Request, Response } from 'express';
import jwtDecode from 'jwt-decode';
import { TokenSet } from 'openid-client';
import { XeroAccessToken, XeroIdToken, XeroClient } from 'xero-node';


import admin from 'firebase-admin';
import {
	getFirestore //,collection,addDoc,getDoc,getDocs,doc,updateDoc,deleteDoc,query, where 
  } from 'firebase/firestore';

  import { initializeApp } from 'firebase/app';

  const firebaseServiceAccount = require("./key.json");


// Initialize Firebase Admin
  admin.initializeApp({
	credential: admin.credential.cert(firebaseServiceAccount)
  });
  
  const firebaseConfig = {
	apiKey: process.env.REACT_APP_APIKEY,
	authDomain: process.env.REACT_APP_AUTHDOMAIN,
	projectId: process.env.REACT_APP_PROJECTID,
	storageBucket: process.env.REACT_APP_STORAGEBUCKET,
	messagingSenderId: process.env.REACT_APP_MESSAGINGSENDERID,
	appId: process.env.REACT_APP_APPID
  };
  
  const fsapp = initializeApp(firebaseConfig);
  const db = getFirestore(fsapp);

  


const session = require('express-session');
	
const client_id: string = process.env.CLIENT_ID;
const client_secret: string = process.env.CLIENT_SECRET;
const redirectUrl: string = process.env.REDIRECT_URI;

if (!client_id || !client_secret || !redirectUrl) {
	throw Error('Environment Variables not all set - please check your .env file in the project root or create one!')
  }

const scopes: string = 'openid profile email offline_access practicemanager.read practicemanager.job.read practicemanager.client.read practicemanager.staff.read practicemanager.time.read'
//const scopes = "offline_access openid profile email accounting.transactions accounting.budgets.read accounting.reports.read accounting.journals.read accounting.settings accounting.settings.read accounting.contacts accounting.contacts.read accounting.attachments accounting.attachments.read files files.read assets assets.read projects projects.read payroll.employees payroll.payruns payroll.payslip payroll.timesheets payroll.settings";


const xero = new XeroClient({
	clientId: client_id,
	clientSecret: client_secret,
	redirectUris: [redirectUrl],
	scopes: scopes.split(' '),
});


const app: express.Application = express();

app.use(express.static(__dirname + '/build'));
app.use(cors());
app.use(session({
	secret: client_secret,
	resave: false,
	saveUninitialized: true,
	cookie: { secure: false },
}));

const authenticationData: any = (req: Request, res: Response) => {
	return {
		decodedIdToken: req.session.decodedIdToken,
		decodedAccessToken: req.session.decodedAccessToken,
		tokenSet: req.session.tokenSet,
		allTenants: req.session.allTenants,
		activeTenant: req.session.activeTenant,
	};
};

app.get('/', (req: Request, res: Response) => {
	res.send(`<a href='/connect'>Connect to Xero</a>`);
});

app.get('/welcome', (req: Request, res: Response) => {
	res.send(`you're in`);
});

app.get('/connect', async (req: Request, res: Response) => {
    try {
        const consentUrl: string = await xero.buildConsentUrl();
        res.json({ consentUrl });  // Send the consentUrl to the client
    } catch (err) {
        res.status(500).send('Sorry, something went wrong');
    }
});

app.get('/callback', async (req: Request, res: Response) => {
	console.log("Callback URL:", req.url);
    try {
		const tokenSet: TokenSet = await xero.apiCallback(req.url);
		await xero.updateTenants(false);//false
		const decodedIdToken: XeroIdToken = jwtDecode(tokenSet.id_token);
		const decodedAccessToken: XeroAccessToken = jwtDecode(tokenSet.access_token);
		req.session.decodedIdToken = decodedIdToken;
		req.session.decodedAccessToken = decodedAccessToken;
		req.session.tokenSet = tokenSet;
		req.session.allTenants = xero.tenants;
		// XeroClient is sorting tenants behind the scenes so that most recent / active connection is at index 0
		//req.session.activeTenant = xero.tenants[0];
		console.log(req.session.allTenants)

		//const demoCompanyTenant = req.session.allTenants.find(tenant => tenant.tenantName === "HK Partners Advisory Pty Ltd");
		const demoCompanyTenant = req.session.allTenants.find(tenant => tenant.tenantName === "HK Partners Advisory Pty Ltd");
          if (demoCompanyTenant) {
              req.session.activeTenant = demoCompanyTenant;
			  console.log(demoCompanyTenant);
          } else {
              throw new Error("Active Tenant for HK Partners not found in req.session.allTenants.");
          }

		const authData: any = authenticationData(req, res);

		//res.status(200).send(authData);


		res.cookie('xero_userid', decodedIdToken.xero_userid, {
			httpOnly: true,
			secure: process.env.NODE_ENV !== 'development',
			sameSite: 'strict'
		});
		
			// Create a custom Firebase token
			const firebaseToken = await admin.auth().createCustomToken(decodedIdToken.xero_userid);
			res.cookie('token', firebaseToken, {
			httpOnly: true,
			secure: process.env.NODE_ENV !== 'development',  // Use secure cookies in production
			sameSite: 'strict'
		});


		res.redirect('http://localhost:3000');
    } catch (err) {
		console.error("Error in /callback:", err);
		res.status(500).send('Sorry, something went wrong.');
	}
	
	
});


app.get('/tenant', (req: Request, res: Response) => {
        // Extract xero_userid from the cookies
        const xero_userid = req.cookies.xero_userid;
    
        if (xero_userid) {
            return res.send({ xero_userid: xero_userid });
        } else {
            res.status(401).send("User not authenticated with Xero.");
        }
    });

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
	console.log(`App listening on port ${PORT}`);
});