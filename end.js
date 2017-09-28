var express = require('express');
var app = express();
var session = require('express-session');
var bodyParser = require('body-parser');
var config = require('./config.json');
var Q = require('q');
process.on('uncaughtException', function(err) {
  console.log("My Errrrr: " + err.stack);
});

app.use(express.static('node_modules'));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(session({ secret: config.secret, resave: false, saveUninitialized: true }));


// start server
var server = app.listen(3003, function () {
    console.log('Server listening at http://' + server.address().address + ':' + server.address().port);
});






var utils = require('fabric-client/lib/utils.js');
var Client = require('fabric-client');
var EventHub = require('fabric-client/lib/EventHub.js');
//var Block = require('fabric-client/lib/Block.js');
var util = require('util');
var fs = require('fs');
var path = require('path');
var grpc = require('grpc');



var _commonProto = grpc.load(path.join(__dirname, './node_modules/fabric-client/lib/protos/common/common.proto')).common;
var _configtxProto = grpc.load(path.join(__dirname, './node_modules/fabric-client/lib/protos/common/configtx.proto')).common;


Client.addConfigFile(path.join(__dirname, './network-config.json'));
var ORGS = Client.getConfigSetting('network-config');

var channel_name = 'mychannel';
var the_user = null;
var tx_id = null;
var nonce = null;


function loadMSPConfig(name, mspdir) {
    var msp = {};
    msp.id = name;
    msp.rootCerts = readAllFiles(path.join(__dirname, mspdir, 'cacerts'));
    msp.admins = readAllFiles(path.join(__dirname, mspdir, 'admincerts'));
    return msp;
}

function readAllFiles(dir) {
    var files = fs.readdirSync(dir);
    var certs = [];
    files.forEach((file_name) => {
        let file_path = path.join(dir,file_name);
        console.log(' looking at file ::'+ file_path);
        let data = fs.readFileSync(file_path);
        certs.push(data);
    });
    return certs;
}

function getOrderAdminSubmitter(client){
    return getOrdererAdmin(client)
}

function getOrdererAdmin(client) {
    var keyPath = path.join(__dirname, './artifacts/crypto-config/ordererOrganizations/example.com/users/Admin@example.com/msp/keystore');
    var keyPEM = Buffer.from(readAllFiles(keyPath)[0]).toString();
    var certPath = path.join(__dirname, './artifacts/crypto-config/ordererOrganizations/example.com/users/Admin@example.com/msp/signcerts');
    var certPEM = readAllFiles(certPath)[0];

    return Promise.resolve(client.createUser({
        username: 'ordererAdmin',
        mspid: 'OrdererMSP',
        cryptoContent: {
            privateKeyPEM: keyPEM.toString(),
            signedCertPEM: certPEM.toString()
        }
    }));
}

function getSubmitter(client, peerOrgAdmin, org) {
    //only by admin
    if (peerOrgAdmin) {
        console.log(' >>>> getting the org admin');
        return getAdmin(client, org);
    } else{
        return getMember('admin', 'adminpw', client, org)
        //return registerUser1('sakaar2', org, client)
    }
};



function registerUser1(username,orgname,client){

    var deferred = Q.defer();

    var caUrl = ORGS[orgname].ca.url;
    var cop = new caService(caUrl, tlsOptions, ORGS[orgname].ca.name);
    hfc.newDefaultKeyValueStore({
        path: storePathForOrg(orgname)
    })
    .then(function(store){
        client.setStateStore(store)
        getAdminUser1(client, orgname)
        .then(function(registrar){

            var request = {
                enrollmentID: username, 
                affiliation: orgname + '.department1',
            }
            console.log(request)

            cop.register(request, registrar)
            .then(function(secret){

                var enrollRequest = {
                    enrollmentID: username,
                    enrollmentSecret: secret
                }

                console.log(enrollRequest)

                cop.enroll(enrollRequest)
                .then(function(message){

                    
                    var user = new User(username);

                    user.setEnrollment(message.key,message.certificate,ORGS[orgname].mspid)
                    .then(function(){
                        client.setUserContext(user)
                        .then(function(user){
                            deferred.resolve(user)
                        })
        
                    })
                    .catch(function(err){
                        deferred.reject(err)
                    })
                })
                .catch(function(err){
                    deferred.reject(err)
                })
            })
            .catch(function(error){
                deferred.reject(error)
            })

        })
        .catch(function(error){
            deferred.reject(error)
        })
    })

    return deferred.promise;

}

function getAdminUser1(client, userOrg) {

    var deferred = Q.defer();

    var caUrl = ORGS[userOrg].ca.url;
    var adminUser = 'admin'
    var password = 'adminpw'
    
    

            var request = {
                enrollmentID: adminUser,
                enrollmentSecret: password
            }

            var cop = new caService(caUrl, tlsOptions, ORGS[userOrg].ca.name);

            cop.enroll(request)
            .then(function(message){
               
                var user = new User(adminUser);

                user.setEnrollment(message.key,message.certificate,ORGS[userOrg].mspid)
                .then(function(){
                    client.setUserContext(user)
                    .then(function(user){
                        deferred.resolve(user)
                    })
                    

                })
                .catch(function(error){
                    deferred.reject(error)
                })
            })
            .catch(function(err){
                deferred.reject(err)
            })
     
   

    return deferred.promise;

};



function getMember(username, password, client, userOrg) {
    var caUrl = ORGS[userOrg].ca.url;

    console.log('getMember, name: '+username+', client.getUserContext('+username+', true)');

    return client.getUserContext(username, true)
    .then((user) => {
        return new Promise((resolve, reject) => {
            if (user && user.isEnrolled()) {
                console.log('Successfully loaded member from persistence');
                return resolve(user);
            }

            var member = new User(username);
            var cryptoSuite = null;
            if (userOrg) {
                cryptoSuite = Client.newCryptoSuite({path: storePathForOrg(ORGS[userOrg].name)});
            } else {
                cryptoSuite = Client.newCryptoSuite();
            }
            member.setCryptoSuite(cryptoSuite);

            // need to enroll it with CA server
            var cop = new caService(caUrl, tlsOptions, ORGS[userOrg].ca.name, cryptoSuite);

            return cop.enroll({
                enrollmentID: username,
                enrollmentSecret: password
            }).then((enrollment) => {
                console.log('Successfully enrolled user \'' + username + '\'');

                return member.setEnrollment(enrollment.key, enrollment.certificate, ORGS[userOrg].mspid);
            }).then(() => {
                return client.setUserContext(member);
            }).then(() => {
                return resolve(member);
            }).catch((err) => {
                console.log('Failed to enroll and persist user. Error: ' + err.stack ? err.stack : err);
            });
        });
    });
}



function getAdmin(client, userOrg) {
    var keyPath = path.join(__dirname, util.format('./artifacts/crypto-config/peerOrganizations/%s.example.com/users/Admin@%s.example.com/msp/keystore', userOrg, userOrg));
    var keyPEM = Buffer.from(readAllFiles(keyPath)[0]).toString();
    var certPath = path.join(__dirname, util.format('./artifacts/crypto-config/peerOrganizations/%s.example.com/users/Admin@%s.example.com/msp/signcerts', userOrg, userOrg));
    var certPEM = readAllFiles(certPath)[0];

    if (userOrg) {
        Client.newCryptoSuite({path: "/tmp/fabric-client-kvs_" + ORGS[userOrg].name});
    }

    return Promise.resolve(client.createUser({
        username: 'peer'+userOrg+'Admin',
        mspid: ORGS[userOrg].mspid,
        cryptoContent: {
            privateKeyPEM: keyPEM.toString(),
            signedCertPEM: certPEM.toString()
        }
    }));
}



// Create Channel
app.post('/channels', function(req, res) {
  

    console.log("===========================CREATE CHANNEL=========================")

    createNewChannel()
    res.send("message");
        
});

function createNewChannel(){

    var the_user = null;
    var client = new Client();

    var caRootsPath = ORGS.orderer.tls_cacerts;
    let data = fs.readFileSync(path.join(__dirname, caRootsPath));
    let caroots = Buffer.from(data).toString();

    var orderer = client.newOrderer(
        ORGS.orderer.url,
        {
            'pem': caroots,
            'ssl-target-name-override': ORGS.orderer['server-hostname']
        }
    );

    var config = null;
    var signatures = [];
   
    var org = ORGS.org1.name;

    utils.setConfigSetting('key-value-store', 'fabric-client/lib/impl/FileKeyValueStore.js');

    Client.newDefaultKeyValueStore({
        path: '/tmp/fabric-client-kvs_peerOrg1'
    })
    .then(function(store){
        client.setStateStore(store);
        getOrderAdminSubmitter(client)
        .then(function(admin){
            let envelope_bytes = fs.readFileSync(path.join(__dirname, './artifacts/channel-artifacts/channel.tx'));
            config = client.extractChannelConfig(envelope_bytes);
                
                client._userContext = null;
                getSubmitter(client,true,'org1')
                .then(function(admin){
                    console.log("!! -- Enrolled admin for org1 -- !!")
                    var signature = client.signChannelConfig(config);
                    var string_signature = signature.toBuffer().toString('hex');
                    console.log("!!!!!!!!!signed the config update - org1 !!!!!!!!!!!")
                    // collect signature from org1 admin
                    // TODO: signature counting against policies on the orderer
                    // at the moment is being investigated, but it requires this
                    // weird double-signature from each org admin
                    signatures.push(string_signature);
                    signatures.push(string_signature);
                    // make sure we do not reuse the user
                    client._userContext = null;

                    getSubmitter(client,true,'org2')
                    .then(function(admin){
                        console.log("!! -- Enrolled admin for org2 -- !!")
                        var signature = client.signChannelConfig(config);
                        var string_signature = signature.toBuffer().toString('hex');
                        console.log('!!!!!!!! Successfully signed config update - org2 !!!!!!!!!!!');
                        // collect signature from org2 admin
                        // TODO: signature counting against policies on the orderer
                        // at the moment is being investigated, but it requires this
                        // weird double-signature from each org admin
                        signatures.push(string_signature);
                        signatures.push(string_signature);

                        // make sure we do not reuse the user
                        client._userContext = null;

                        getOrderAdminSubmitter(client)
                        .then(function(admin){
                            console.log("!!!!!!!! Enrolled admin for orderer !!!!!!!!")
                            the_user = admin;
                            var signature = client.signChannelConfig(config);
                            var string_signature = signature.toBuffer().toString('hex');
                            console.log('!!!!!Admin orderer Successfully signed config update!!!!');
                            signatures.push(string_signature);
                            signatures.push(string_signature);
                            console.log("******** DONE SIGNING ***********")

                            let tx_id = client.newTransactionID();
                            var request = {
                                config: config,
                                signatures : signatures,
                                name : channel_name,
                                orderer : orderer,
                                txId  : tx_id
                            };

                            client.createChannel(request)
                            .then(function(result){
                                console.log(result)
                                console.log("********Successfully created the channel************")

                            })
                            .catch(function(error){
                                console.log("*********Error in creating channel****************")
                                console.log("Error is : " + error)
                            })

                        })
                    })

                })
        })

    })



}



function storePathForOrg(org) {
    return '/tmp/fabric-client-kvs' + '_' + org;
};


// Join Channel
app.post('/join', function(req, res) {
  

    console.log("===========================JOIN CHANNEL API =========================")

    JoinTheChannels()
    res.send("message");
        
});


function JoinTheChannels(){
    
   joinChannel('org1')
   .then(function(res){
         console.log("!!!!!!!!!! -- JoinTheChannel : Org1 successfully joined the channel -- !!!!!!!!!!!!")
         joinChannel('org2')
         .then(function(res){
            console.log("!!!!!!!!!! -- JoinTheChannel : Org2 successfully joined the channel -- !!!!!!!!!!!!")
         })
         .catch(function(err){
            console.log("!!!!!!!!!! -- JoinTheChannel : Error in org2 joining the channel -- !!!!!!!!!!!!")
         })
   })
   .catch(function(err){
        console.log("!!!!!!!!!! -- JoinTheChannel : Error in org1 joining the channel -- !!!!!!!!!!!!")
   })   
}

function joinChannel(org){
    console.log(util.format('Calling peers in organization "%s" to join the channel', org))
    var deferred = Q.defer();


    var client = new Client();
    var chain = client.newChannel(channel_name);

    var orgName = ORGS[org].name;

    var targets = [];


    var caRootsPath = ORGS.orderer.tls_cacerts;
    let data = fs.readFileSync(path.join(__dirname, caRootsPath));
    let caroots = Buffer.from(data).toString();
    var genesis_block = null;

    chain.addOrderer(
        client.newOrderer(
            ORGS.orderer.url,
            {
                'pem': caroots,
                'ssl-target-name-override': ORGS.orderer['server-hostname']
            }
        )
    );

    Client.newDefaultKeyValueStore({
        path: storePathForOrg(orgName)
    })
    .then(function(store){
        client.setStateStore(store);

        getOrderAdminSubmitter(client)
        .then(function(admin){
            console.log('!!!!!!!Successfully enrolled orderer \'admin\'!!!!!!!!!');
            tx_id = client.newTransactionID();
            let request = {
                txId :  tx_id
            };
            chain.getGenesisBlock(request)
            .then(function(block){
                console.log('++++++++++++Successfully got the genesis block++++++++++++++');
                genesis_block = block;
                // get the peer org's admin required to send join channel requests
                client._userContext = null;

                getSubmitter(client, true, org)
                .then(function(admin){
                    console.log('##########Successfully enrolled org:' + org + ' \'admin\'#############3');
                    the_user = admin;



                    for (let key in ORGS[org]) {
                        if (ORGS[org].hasOwnProperty(key)) {
                            if (key.indexOf('peer1') === 0) {
                                data = fs.readFileSync(path.join(__dirname, ORGS[org][key]['tls_cacerts']));
                                targets.push(
                                    client.newPeer(
                                        ORGS[org][key].requests,
                                        {
                                            pem: Buffer.from(data).toString(),
                                            'ssl-target-name-override': ORGS[org][key]['server-hostname']
                                        }
                                    )
                                );
                            }
                        }
                    }

                    tx_id = client.newTransactionID();
                    let request = {
                        targets : targets,
                        block : genesis_block,
                        txId :  tx_id
                    };

                    chain.joinChannel(request)
                    .then(function(results){

                        console.log(util.format('Join Channel R E S P O N S E : %j', results));

                        if(results[0] && results[0].response.status == 200) {
                            console.log(util.format('Successfully joined peers in organization %s to join the channel', orgName));
                            deferred.resolve()
                        } else {
                            console.log(util.format('Peers in organization %s failed to join the channel', orgName));
                            deferred.reject()
                        }

                    })
                    .catch(function(error){
                        console.log('Failed to join channel due to error: ' + error.stack ? error.stack : error);
                        deferred.reject()
                    })


                })



            })
            .catch(function(error){
                console.log('++++++++++++Unsuscessful retreival of the genesis block++++++++++++++');
                console.log("Error is : " + error)
                deferred.reject()
            })
        })


    })

    return deferred.promise;
}


var chaincode_path = "go/supplychain"
var version = "v1"
var chaincodeId = "winechain1"
var hfc = require('fabric-client');
// install chaincode
app.post('/install', function(req, res) {
  

    console.log("===========================INSTALL CHAINCODE API =========================")

    setupChaincodeDeploy()
    installTheChaincode()
  
    res.send("message");
        
});



function setupChaincodeDeploy(){
    process.env.GOPATH = path.join(__dirname, './chaincode');
}

function installTheChaincode(){

    installChaincode('org1',chaincode_path, version)
   .then(function(res){
         console.log("!!!!!!!!!! -- installChaincode : Org1 successfully installed chaincode -- !!!!!!!!!!!!")
         installChaincode('org2',chaincode_path, version)
         .then(function(res){
            console.log("!!!!!!!!!! -- installChaincode : Org2 successfully installed chaincode -- !!!!!!!!!!!!")
         })
         .catch(function(err){
            console.log("!!!!!!!!!! -- installChaincode : Error in org2 installing chaincode -- !!!!!!!!!!!!")
         })
   })
   .catch(function(err){
        console.log("!!!!!!!!!! -- installChaincode : Error in org1 installing chaincode -- !!!!!!!!!!!!")
   })
}

function installChaincode(org, chaincode_path, version){

    console.log(util.format('Calling peers in organization "%s" to install the chaincode', org))
    var deferred = Q.defer();

    hfc.setConfigSetting('request-timeout', 60000);

    var client = new hfc();
    var chain = client.newChannel(channel_name);

    var orgName = ORGS[org].name;
    Client.newCryptoSuite({path: storePathForOrg(orgName)});

    var caRootsPath = ORGS.orderer.tls_cacerts;
    let data = fs.readFileSync(path.join(__dirname, caRootsPath));
    let caroots = Buffer.from(data).toString();

    chain.addOrderer(
        client.newOrderer(
            ORGS.orderer.url,
            {
                'pem': caroots,
                'ssl-target-name-override': ORGS.orderer['server-hostname']
            }
        )
    );

    var targets = [];
    for (let key in ORGS[org]) {
        if (ORGS[org].hasOwnProperty(key)) {
            if (key.indexOf('peer1') === 0) {
                let data = fs.readFileSync(path.join(__dirname, ORGS[org][key]['tls_cacerts']));
                let peer = client.newPeer(
                    ORGS[org][key].requests,
                    {
                        pem: Buffer.from(data).toString(),
                        'ssl-target-name-override': ORGS[org][key]['server-hostname']
                    }
                );

                targets.push(peer);
                chain.addPeer(peer);
            }
        }
    }

    hfc.newDefaultKeyValueStore({
        path: storePathForOrg(orgName)
    })
    .then(function(store){

        client.setStateStore(store);
        getSubmitter(client,true,org)
        .then(function(admin){
            console.log(" ############ Successfully enrolled admin ################")
            
            // send proposal to endorser
            var request = {
                targets: targets,
                chaincodePath: chaincode_path,
                chaincodeId: chaincodeId,
                chaincodeVersion: version
            };

            client.installChaincode(request)
            .then(function(results){

                console.log(" R E S U L T S :")
              
                var proposalResponses = results[0];

                var proposal = results[1];
                var header   = results[2];
                var all_good = true;
                var errors = [];
                for(var i in proposalResponses) {
                    let one_good = false;
                    if (proposalResponses && proposalResponses[0].response && proposalResponses[0].response.status === 200) {
                        one_good = true;
                        console.log('install proposal was good');
                    } else {
                        console.log('install proposal was bad');
                    }
                    all_good = all_good & one_good;
                }
                if (all_good) {
                    console.log(util.format('Successfully sent install Proposal and received ProposalResponse: Status - %s', proposalResponses[0].response.status));
                    deferred.resolve()
                } else {
                    console.log(util.format('Failed to send install Proposal or receive valid response: %s', errors));
                    deferred.reject()
                }

            })
            .catch(function(error){
                console.log("CHAICODE INSTALL ERROR")
                console.log("Error is :" +  error)
                deferred.reject()
            })

        })

    })

    return deferred.promise;

}



app.post('/start', function(req, res) {
  

    console.log("===========================INSTANTIATE CHAINCODE API =========================")

    setupChaincodeDeploy()
    instantiateChaincode('org2',chaincode_path, version)
  
    res.send("message");
        
});


function instantiateChaincode(userOrg, chaincode_path, version){


    hfc.setConfigSetting('request-timeout', 6000000);

    var targets = [];

    var type = 'instantiate';

    var client = new hfc();
    var chain = client.newChannel(channel_name);

    var orgName = ORGS[userOrg].name;
    Client.newCryptoSuite({path: storePathForOrg(orgName)});

    var caRootsPath = ORGS.orderer.tls_cacerts;
    let data = fs.readFileSync(path.join(__dirname, caRootsPath));
    let caroots = Buffer.from(data).toString();

    chain.addOrderer(
        client.newOrderer(
            ORGS.orderer.url,
            {
                'pem': caroots,
                'ssl-target-name-override': ORGS.orderer['server-hostname']
            }
        )
    );

    var targets = [];
    
    hfc.newDefaultKeyValueStore({ path: storePathForOrg(orgName) })
    .then(function(store){
        client.setStateStore(store)
        getSubmitter(client, true, userOrg)
        .then(function(admin){

            console.log('Successfully enrolled user \'admin\'');
            the_user = admin;

            for(let org in ORGS) {
                if (ORGS[org].hasOwnProperty('peer1')) {
                    let key = 'peer1';
                    let data = fs.readFileSync(path.join(__dirname, ORGS[org][key]['tls_cacerts']));
                    console.log(' create new peer ' + ORGS[org][key].requests);
                    let peer = client.newPeer(
                        ORGS[org][key].requests,
                        {
                            pem: Buffer.from(data).toString(),
                            'ssl-target-name-override': ORGS[org][key]['server-hostname']
                        }
                    );

                    targets.push(peer);
                    chain.addPeer(peer);
                }
            }

            chain.initialize()
            .then(function(){

                let request = buildChaincodeProposal(the_user, channel_name, chaincode_path, version, client);
                tx_id = request.txId;

                chain.sendInstantiateProposal(request)
                .then(function(results){

                    var proposalResponses = results[0];
                    var proposal = results[1];
                    var header   = results[2];
                    var all_good = true;

                    for(var i in proposalResponses) {
                        let one_good = false;
                        if (proposalResponses && proposalResponses[i].response && proposalResponses[i].response.status === 200) {
                            // special check only to test transient map support during chaincode upgrade
                            one_good = true;
                            console.log(type +' : proposal was good');
                        } else {
                            console.log(type +' : proposal was bad');
                        }
                        all_good = all_good & one_good;
                    }
                    console.log("ALL GOOD :" + all_good)
                    if (all_good) {
                        console.log(util.format('Successfully sent Proposal and received ProposalResponse: Status - %s, message - "%s", metadata - "%s", endorsement signature: %s', proposalResponses[0].response.status, proposalResponses[0].response.message, proposalResponses[0].response.payload, proposalResponses[0].endorsement.signature));
                        var request = {
                            proposalResponses: proposalResponses,
                            proposal: proposal,
                            header: header
                        };

                        var deployId = tx_id.getTransactionID();

                        chain.sendTransaction(request)
                        .then(function(results){
                            console.log("!!!!!!!!!!!!! sendTransaction results !!!!!!!!!!!!!")
                            console.log(results)
                            var response = results;
                            console.log(response)
                            if (!(response instanceof Error) && response.status === 'SUCCESS') {
                                console.log('Successfully sent ' + type + 'transaction to the orderer.');
                            } else {
                                console.log('Failed to order the ' + type + 'transaction. Error code: ' + response.status);
                            }

                        })
                        .catch(function(error){
                            console.log("!!!!!!!!!!!! sendTransaction E R R O R !!!!!!!!!!!!!!!!!!!")
                            console.log("Error is : " + error)
                        })

                    }else {
                            console.log('Failed to send ' + type + ' Proposal or receive valid response. Response null or status is not 200. exiting...');
                    }

                })




            })
            .catch(function(error){
                console.log(util.format('Failed to initialize the chain. %s', error.stack ? error.stack : error));
            })




        })

    })



}





app.post('/upgrade', function(req, res) {
  

    console.log("===========================UPGRADE CHAINCODE API =========================")

    setupChaincodeDeploy()
    upgradeChaincode('org1',chaincode_path, version)
  
    res.send("message");
        
});


function upgradeChaincode(userOrg, chaincode_path, version){


    hfc.setConfigSetting('request-timeout', 60000);

    var targets = [];

    var type = 'instantiate';

    var client = new hfc();
    var chain = client.newChannel(channel_name);

    var orgName = ORGS[userOrg].name;
    //client.newCryptoSuite({path: storePathForOrg(orgName)});

    var caRootsPath = ORGS.orderer.tls_cacerts;
    let data = fs.readFileSync(path.join(__dirname, caRootsPath));
    let caroots = Buffer.from(data).toString();

    chain.addOrderer(
        client.newOrderer(
            ORGS.orderer.url,
            {
                'pem': caroots,
                'ssl-target-name-override': ORGS.orderer['server-hostname']
            }
        )
    );

    var targets = [];
    
    hfc.newDefaultKeyValueStore({ path: storePathForOrg(orgName) })
    .then(function(store){
        client.setStateStore(store)
        getSubmitter(client, true, userOrg)
        .then(function(admin){

            console.log('Successfully enrolled user \'admin\'');
            the_user = admin;

            for(let org in ORGS) {
                if (ORGS[org].hasOwnProperty('peer1')) {
                    let key = 'peer1';
                    let data = fs.readFileSync(path.join(__dirname, ORGS[org][key]['tls_cacerts']));
                    console.log(' create new peer ' + ORGS[org][key].requests);
                    let peer = client.newPeer(
                        ORGS[org][key].requests,
                        {
                            pem: Buffer.from(data).toString(),
                            'ssl-target-name-override': ORGS[org][key]['server-hostname']
                        }
                    );

                    targets.push(peer);
                    chain.addPeer(peer);
                }
            }

            chain.initialize()
            .then(function(){

                let request = buildChaincodeProposal(the_user, channel_name, chaincode_path, version, client);
                tx_id = request.txId;

                chain.sendUpgradeProposal(request)
                .then(function(results){

                    var proposalResponses = results[0];
                    var proposal = results[1];
                    var header   = results[2];
                    var all_good = true;

                    for(var i in proposalResponses) {
                        let one_good = false;
                        if (proposalResponses && proposalResponses[i].response && proposalResponses[i].response.status === 200) {
                            // special check only to test transient map support during chaincode upgrade
                            one_good = true;
                            console.log(type +' : proposal was good');
                        } else {
                            console.log(type +' : proposal was bad');
                        }
                        all_good = all_good & one_good;
                    }
                    console.log("ALL GOOD :" + all_good)
                    if (all_good) {
                        console.log(util.format('Successfully sent Proposal and received ProposalResponse: Status - %s, message - "%s", metadata - "%s", endorsement signature: %s', proposalResponses[0].response.status, proposalResponses[0].response.message, proposalResponses[0].response.payload, proposalResponses[0].endorsement.signature));
                        var request = {
                            proposalResponses: proposalResponses,
                            proposal: proposal,
                            header: header
                        };

                        var deployId = tx_id.getTransactionID();

                        chain.sendTransaction(request)
                        .then(function(results){
                            console.log("!!!!!!!!!!!!! sendTransaction results !!!!!!!!!!!!!")
                            console.log(results)
                            var response = results;
                            console.log(response)
                            if (!(response instanceof Error) && response.status === 'SUCCESS') {
                                console.log('Successfully sent ' + type + 'transaction to the orderer.');
                            } else {
                                console.log('Failed to order the ' + type + 'transaction. Error code: ' + response.status);
                            }

                        })
                        .catch(function(error){
                            console.log("!!!!!!!!!!!! sendTransaction E R R O R !!!!!!!!!!!!!!!!!!!")
                            console.log("Error is : " + error)
                        })

                    }else {
                            console.log('Failed to send ' + type + ' Proposal or receive valid response. Response null or status is not 200. exiting...');
                    }

                })




            })
            .catch(function(error){
                console.log(util.format('Failed to initialize the chain. %s', error.stack ? error.stack : error));
            })




        })

    })



}


function buildChaincodeProposal(the_user, channelId, chaincode_path, version, client) {

    var tx_id = client.newTransactionID(the_user);

    // send proposal to endorser
    var request = {
        chaincodePath: chaincode_path,
        chaincodeId: chaincodeId,
        chaincodeVersion: version,
        fcn: 'init',
        args: [],
        txId: tx_id,
        // use this to demonstrate the following policy:
        // 'if signed by org1 admin, then that's the only signature required,
        // but if that signature is missing, then the policy can also be fulfilled
        // when members (non-admin) from both orgs signed'
        'endorsement-policy': {
            identities: [
                { role: { name: 'member', mspId: ORGS['org1'].mspid }},
                { role: { name: 'member', mspId: ORGS['org2'].mspid }},
                { role: { name: 'admin', mspId: ORGS['org1'].mspid }}
            ],
            policy: {
                "1-of": [{ "signed-by": 1 }, { "signed-by": 2 }]
            }
        }
    };

    return request;
}



app.post('/invoke', function(req, res) {
  

    console.log("===========================INVOKE CHAINCODE API =========================")
    console.log(version)
    invokeChaincode('org1', version)
  
    res.send("message");
        
});


function invokeChaincode(userOrg, version){

    hfc.setConfigSetting('request-timeout', 60000);
    var targets = [];

    var client = new hfc();
    var chain = client.newChannel(channel_name);

    var orgName = ORGS[userOrg].name;
    //client.newCryptoSuite({path: storePathForOrg(orgName)});

    var caRootsPath = ORGS.orderer.tls_cacerts;
    let data = fs.readFileSync(path.join(__dirname, caRootsPath));
    let caroots = Buffer.from(data).toString();

    chain.addOrderer(
        client.newOrderer(
            ORGS.orderer.url,
            {
                'pem': caroots,
                'ssl-target-name-override': ORGS.orderer['server-hostname']
            }
        )
    );

    hfc.newDefaultKeyValueStore({ path: storePathForOrg(userOrg) })
    .then(function(store){
        client.setStateStore(store)
        //getSubmitter(client,false,userOrg)
        registerUser1('sakaar5', userOrg, client)
        .then(function(admin){
            console.log('Successfully enrolled user \'admin\'');
            the_user = admin;
            console.log(the_user)


            for (let key in ORGS) {
                if (ORGS.hasOwnProperty(key) && typeof ORGS[key].peer1 !== 'undefined') {
                    let data = fs.readFileSync(path.join(__dirname, ORGS[key].peer1['tls_cacerts']));
                    let peer = client.newPeer(
                        ORGS[key].peer1.requests,
                        {
                            pem: Buffer.from(data).toString(),
                            'ssl-target-name-override': ORGS[key].peer1['server-hostname']
                        }
                    );
                    //\\if(key == 'org1')
                    chain.addPeer(peer);
                }
            }

            let data = fs.readFileSync(path.join(__dirname, ORGS[userOrg].peer1['tls_cacerts']));
            eh = client.newEventHub();
            eh.setPeerAddr(
                ORGS[userOrg].peer1.events,
                {
                    pem: Buffer.from(data).toString(),
                    'ssl-target-name-override': ORGS[userOrg].peer1['server-hostname']
                });
            eh.connect();
            
            console.log("hahahahahahahahahahahahahahahahahahahahahaha")
           
            chain.initialize()
            .then(function(nothing){


                tx_id = client.newTransactionID(the_user);
                console.log("Tx ID : " + tx_id)
                utils.setConfigSetting('E2E_TX_ID', tx_id);
                console.log(util.format('Sending transaction "%s"', tx_id));

                // send proposal to endorser
                var request = {
                    chaincodeId : chaincodeId,
                    fcn: 'invoke',
                    args: ['move', 'sakaar', 'mumbai'],
                    txId: tx_id
                };

                chain.sendTransactionProposal(request)
                .then(function(results){
                   

                    var proposalResponses = results[0];
                    console.log(proposalResponses[0].response.payload.toString('utf8'))
                    var proposal = results[1];
                    var header   = results[2];
                    var all_good = true;
                    for(var i in proposalResponses) {
                        let one_good = false;
                        let proposal_response = proposalResponses[i];
                        if( proposal_response.response && proposal_response.response.status === 200) {
                            console.log('transaction proposal has response status of good');
                            one_good = chain.verifyProposalResponse(proposal_response);
                            if(one_good) {
                                console.log(' transaction proposal signature and endorser are valid');
                            }
                        } else {
                            console.log('transaction proposal was bad');
                        }
                        all_good = all_good & one_good;
                    }

                    console.log("ALL GOOD : " + all_good)

                    if (all_good) {
                        // check all the read/write sets to see if the same, verify that each peer
                        // got the same results on the proposal
                        all_good = chain.compareProposalResponseResults(proposalResponses);
                        console.log('compareProposalResponseResults exection did not throw an error');
                        if(all_good){
                            console.log(' All proposals have a matching read/writes sets');
                        }
                        else {
                            console.log(' All proposals do not have matching read/write sets');
                        }
                    }
                    if (all_good) {
                        // check to see if all the results match
                        console.log(util.format('Successfully sent Proposal and received ProposalResponse: Status - %s, message - "%s", metadata - "%s", endorsement signature: %s', proposalResponses[0].response.status, proposalResponses[0].response.message, proposalResponses[0].response.payload, proposalResponses[0].endorsement.signature));
                        var request = {
                            proposalResponses: proposalResponses,
                            proposal: proposal,
                            header: header
                        };

                        // set the transaction listener and set a timeout of 30sec
                        // if the transaction did not get committed within the timeout period,
                        // fail the test
                        var deployId = tx_id.getTransactionID();

                        eh.registerTxEvent(
                        deployId,
                        function(block,code,msg){
                            console.log("New Tx :" +block + " code : " + code + " msg : " + msg)
                            eh.unregisterTxEvent(deployId);
                        },
                        function(err){
                            console.log("Error Tx is :" +err)
                           eh.unregisterTxEvent(deployId);
                        })


                        chain.sendTransaction(request)
                        .then(function(response){
                            console.log(response)

                            if (response.status === 'SUCCESS') {
                                console.log(" ================= TRANSACTION SUCCESSFULL ======================")
                            }else{
                                console.log(" ================= TRANSACTION UNSUCCESSFULL ======================")
                            }
                        })
                        .catch(function(error){
                            console.log("!!!!!!!!!!!!sendTransaction ERRORRRRR!!!!!!!!!!!!!!")
                            console.log("Error is : " + error)
                        })

                    }else{
                        console.log(" =================  ALL IS NOT GOOD ================= ")
                    }

                })
                .catch(function(error){
                    console.log("!!!!!!!!!!!!!!!!!sendTransactionProposal ERROR!!!!!!!!!!!!!!!!!!!")
                    console.log("Error is :" + error)
                })

            })
            .catch(function(error){
                console.log("!!!!!!!!!!!!1 chain initialize error !!!!!!!!!!!!!!")
                console.log("Error is :" + error)
            })

        })
    })

}



app.post('/query', function(req, res) {
  

    console.log("===========================QUERY CHAINCODE API =========================")
    console.log(version)
    queryChaincode('org2', version)
  
    res.send("message");
        
});

function queryChaincode(org, version){


    hfc.setConfigSetting('request-timeout', 60000);
    // this is a transaction, will just use org's identity to
    // submit the request. intentionally we are using a different org
    // than the one that submitted the "move" transaction, although either org
    // should work properly
    var client = new hfc();
    var chain = client.newChannel(channel_name);

    var orgName = ORGS[org].name;
    //client.newCryptoSuite({path: storePathForOrg(orgName)});

    var targets = [];
    // set up the chain to use each org's 'peer1' for
    // both requests and events
    for (let key in ORGS) {
        if (ORGS.hasOwnProperty(key) && typeof ORGS[key].peer1 !== 'undefined') {
            let data = fs.readFileSync(path.join(__dirname, ORGS[key].peer1['tls_cacerts']));
            let peer = client.newPeer(
                ORGS[key].peer1.requests,
                {
                    pem: Buffer.from(data).toString(),
                    'ssl-target-name-override': ORGS[key].peer1['server-hostname']
                });
            chain.addPeer(peer);
        }
    }

    hfc.newDefaultKeyValueStore({
        path: storePathForOrg(orgName)
    }).then(function(store){
        client.setStateStore(store)
        getSubmitter(client, true, org)
        .then(function(admin){

            the_user = admin;

           tx_id = client.newTransactionID(the_user);

            // send query
            var request = {
                chaincodeId : chaincodeId,
                txId: tx_id,
                fcn: 'invoke',
                args: ['normal','sakaar']
            };

            chain.queryByChaincode(request)
            .then(function(response_payloads){
                console.log(response_payloads)
                if (response_payloads) {
                    for(let i = 0; i < response_payloads.length; i++) {
                       
                    
                        console.log(response_payloads[i].toString('utf8'))
                               
                    }
                } else {
                    console.log('response_payloads is null');
                }

                

                
            })
            .catch(function(error){
                console.log("!!!!!!!!!!!ERROR RETREIVING QUERY RESULTS!!!!!!!!!!!!!!!")
                console.log("Error is : " + error)
            })
        })

    })

}



//################################################################################
var caService = require('fabric-ca-client/lib/FabricCAClientImpl.js');
var FabricCAClient = caService.FabricCAClient;


var tlsOptions = {
    trustedRoots: [],
    verify: false
};


var User = require('fabric-client/lib/User.js');
var CryptoSuite = require('fabric-client/lib/impl/CryptoSuite_ECDSA_AES.js');

//EventHubConnect('org1',version)
function EventHubConnect(org, version){

 
    var eh;
    hfc.setConfigSetting('request-timeout', 60000);
    // thi =s is a transaction, will just use org's identity to
    // submit the request. intentionally we are using a different org
    // than the one that submitted the "move" transaction, although either org
    // should work properly
    var client = new hfc();
    var chain = client.newChannel(channel_name);

    var orgName = ORGS[org].name;
    //client.newCryptoSuite({path: storePathForOrg(orgName)});

    var targets = [];
    // set up the chain to use each org's 'peer1' for
    // both requests and events
    for (let key in ORGS) {
        if (ORGS.hasOwnProperty(key) && typeof ORGS[key].peer1 !== 'undefined') {
            let data = fs.readFileSync(path.join(__dirname, ORGS[key].peer1['tls_cacerts']));
            let peer = client.newPeer(
                ORGS[key].peer1.requests,
                {
                    pem: Buffer.from(data).toString(),
                    'ssl-target-name-override': ORGS[key].peer1['server-hostname']
                });
            chain.addPeer(peer);
        }
    }

    hfc.newDefaultKeyValueStore({
        path: storePathForOrg(orgName)
    }).then(function(store){
        client.setStateStore(store)
        getSubmitter(client, true, org)
        .then(function(admin){

            the_user = admin;

            let data = fs.readFileSync(path.join(__dirname, ORGS[org].peer1['tls_cacerts']));
            eh = client.newEventHub();
            eh.setPeerAddr(
                ORGS[org].peer1.events,
                {
                    pem: Buffer.from(data).toString(),
                    'ssl-target-name-override': ORGS[org].peer1['server-hostname']
                });
            eh.connect();
            

            eh.registerBlockEvent(
                function(block){
                    console.log(block)
                },
                function(err){
                    console.log("Error is :" +err)
                })


        })

    })

}


chainEventCoonect('org2',version)
function chainEventCoonect(org, version){

 
    var eh;
    hfc.setConfigSetting('request-timeout', 60000);
    // thi =s is a transaction, will just use org's identity to
    // submit the request. intentionally we are using a different org
    // than the one that submitted the "move" transaction, although either org
    // should work properly
    var client = new hfc();
    var chain = client.newChannel(channel_name);

    var orgName = ORGS[org].name;
    //client.newCryptoSuite({path: storePathForOrg(orgName)});

    var targets = [];
    // set up the chain to use each org's 'peer1' for
    // both requests and events
    for (let key in ORGS) {
        if (ORGS.hasOwnProperty(key) && typeof ORGS[key].peer1 !== 'undefined') {
            let data = fs.readFileSync(path.join(__dirname, ORGS[key].peer1['tls_cacerts']));
            let peer = client.newPeer(
                ORGS[key].peer1.requests,
                {
                    pem: Buffer.from(data).toString(),
                    'ssl-target-name-override': ORGS[key].peer1['server-hostname']
                });
            chain.addPeer(peer);
        }
    }

    hfc.newDefaultKeyValueStore({
        path: storePathForOrg(orgName)
    }).then(function(store){
        client.setStateStore(store)
        getSubmitter(client, true, org)
        .then(function(admin){

            the_user = admin;

            let data = fs.readFileSync(path.join(__dirname, ORGS[org].peer1['tls_cacerts']));
            eh = new EventHub(client);
            eh.setPeerAddr(
                ORGS[org].peer1.events,
                {
                    pem: Buffer.from(data).toString(),
                    'ssl-target-name-override': ORGS[org].peer1['server-hostname']
                });
            eh.connect();
            

            eh.registerChaincodeEvent(
                chaincodeId,
                "evtsender",
                function(block){
                    console.log("New Event :" +block)
                    console.log(block.payload.toString('utf8'))
                },
                function(err){
                    console.log("Error is :" +err)
                })


        })

    })

}





EventHubConnect2('org1')
function EventHubConnect2(org){

 
    var eh;
    hfc.setConfigSetting('request-timeout', 60000);
    // thi =s is a transaction, will just use org's identity to
    // submit the request. intentionally we are using a different org
    // than the one that submitted the "move" transaction, although either org
    // should work properly
    var client = new hfc();
    var chain = client.newChannel(channel_name);

    var orgName = ORGS[org].name;
    //client.newCryptoSuite({path: storePathForOrg(orgName)});

    var targets = [];
    // set up the chain to use each org's 'peer1' for
    // both requests and events
    

    hfc.newDefaultKeyValueStore({
        path: storePathForOrg(orgName)
    }).then(function(store){
        client.setStateStore(store)
        getSubmitter(client, true, org)
        .then(function(admin){

            the_user = admin;

            let data = fs.readFileSync(path.join(__dirname, ORGS[org].peer1['tls_cacerts']));
            eh = client.newEventHub();
            eh.setPeerAddr(
                ORGS[org].peer1.events,
                {
                    pem: Buffer.from(data).toString(),
                    'ssl-target-name-override': ORGS[org].peer1['server-hostname']
                });
            eh.connect();
            

            eh.registerBlockEvent(
                function(block){
                    console.log(block)
                },
                function(err){
                    console.log("Error is :" +err)
                })


        })

    })

}
