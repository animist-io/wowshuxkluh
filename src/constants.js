angular.module('animist').service("AnimistConstants", AnimistConstants);

function AnimistConstants(){

    this.events = {

        initiatedBLE: 'Animist:initiatedBLEConnection',
        receivedTx: 'Animist:receivedTx',
        sendTxSuccess: 'Animist:sendTxSuccess',
        sendTxFailure: 'Animist:sendTxFailure',
        sendTxMethodFailure: 'Animist:sendTxMethodFailure',
        verifyPresenceSuccess: 'Animist:verifyPresenceSuccess',
        verifyPresenceFailure: 'Animist:verifyPresenceFailure',
        unauthorizedTx: 'Animist:unauthorizedTx',
        noTxFound: 'Animist:noTxFound',
        bleFailure: 'Animist:bleFailure'
    };

    // BLE Server Characteristic UUID vals
    this.serverCharacteristicUUIDs = {

        auth: "E219B7F9-7BF3-4B03-8DB6-88D228922F40", // WTF is this?
        getPin : "C40C94B3-D9FF-45A0-9A37-032D72E423A9",
        getDeviceAccount: "1FD26CCA-EA2B-4B9E-A59E-17AA7E61A0AC",
        getBlockNumber : "C888866C-3499-4B80-B145-E1A61620F885", 
        getAccountBalance: "A85B7044-F1C5-43AD-873A-CF923B6D62E7",
        getTxStatus: "03796948-4475-4E6F-812E-18807B28A84A",
        getNewSessionId : "9BBA5055-57CA-4F78-BA61-52F4154382CF",
        getClientTxStatus : "421522D1-C7EE-494C-A1E4-029BBE644E8D",
        getPgpKeyId: "75C06966-FEF2-4B23-A5AE-60BA8A5C622C",
        getPresenceReceipt: "BA2C3091-DAB8-4D51-BF92-3A6F023E9AD7",
        getContract:  "BFA15C55-ED8F-47B4-BD6A-31280E98C7BA",
        getContractAddress: "007A62CC-068F-4E85-898E-7EA98AD4E31B",
        verifyPresence: "297E3B0A-F353-4531-9D44-3686CC8C4036",
        verifyPresenceAndSendTx: "8D8577B9-E2F0-4750-BB82-421750D9BF86",
        sendTx : "3340BC2C-70AE-4E7A-BE24-8B2ED8E3ED06",
        callTx : "4506C117-0A27-4D90-94A1-08BB81B0738F"
    };

    // Beacon uuid (key) mapped to server service uuid (val). Platform wide constant.
    this.serverServiceUUIDs = {
        "4F7C5946-87BB-4C50-8051-D503CEBA2F19" : "05DEE885-E723-438F-B733-409E4DBFA694",
    };

    this.serverHexCodes = {
        "INVALID_JSON_IN_REQUEST":   0x02,
        "INVALID_TX_HASH":           0x07,
        "INVALID_PIN":               0x09,
        "INVALID_TX_SENDER_ADDRESS": 0x0A,
        "INVALID_TX_SIGNATURE":      0x0B, 
        "INSUFFICIENT_GAS":          0x0C,
        "INSUFFICIENT_BALANCE":      0x0D,
        "INVALID_SESSION_ID":        0x0E,
        "INVALID_CALL_DATA":         0x11,
        "SESSION_NOT_FOUND" :        0x10,
        "TX_PENDING":                0x0F,
        "NO_SIGNED_MSG_IN_REQUEST":  0x03,
        "NO_TX_DB_ERR":              0x04,
        "NO_TX_ADDR_ERR":            0x05,
        "NO_ETHEREUM" :              0x08,
        "RESULT_SUCCESS":            0x00,
        "EOF" :                      "EOF"
    };

}