
package main


import (
	"fmt"
	"encoding/json"
	"bytes"
	"strconv"
	"time"
	"net/http"
	"net/url"

	"github.com/hyperledger/fabric/core/chaincode/shim"
	pb "github.com/hyperledger/fabric/protos/peer"
)

// SimpleChaincode example simple Chaincode implementation
type SimpleChaincode struct {
}

type info struct {
	Name                	string  `json:"name"`
	City					string   `json:"city"`
}


func (t *SimpleChaincode) Init(stub shim.ChaincodeStubInterface) pb.Response  {
    
	return shim.Success(nil)


}


// Transaction makes payment of X units from A to B
func (t *SimpleChaincode) Invoke(stub shim.ChaincodeStubInterface) pb.Response {
   
   function, args := stub.GetFunctionAndParameters()
	
	if function != "invoke" {
                return shim.Error("Unknown function call")
	}

	if len(args) < 2 {
		return shim.Error("Incorrect number of arguments. Expecting at least 2")
	}

	if args[0] == "check" {
		// queries an entity state
		return t.check(stub, args)
	}
	if args[0] == "move" {
		// Deletes an entity from its state
		return t.move(stub, args)
	}

	if args[0] == "api" {
		// Deletes an entity from its state
		return t.api(stub, args)
	}

	if args[0] == "normal" {
		// Deletes an entity from its state
		return t.normal(stub, args)
	}
	return shim.Error("Unknown action, check the first argument, must be one of 'delete', 'query', or 'move'")
}

func (t *SimpleChaincode) move(stub shim.ChaincodeStubInterface, args []string) pb.Response {
	// must be an invoke
	_name := args[1];
	_city := args[2];

	_info := info{
		Name: _name,
		City: _city}

	bytes, err := json.Marshal(_info)
	if err != nil {
		return shim.Error(err.Error())
	}

	
	err = stub.SetEvent("evtsender", []byte("This is my new data"))
	if err != nil {
		return shim.Error(err.Error())
	}

	err = stub.PutState(_name, bytes)
	if err != nil {
		return shim.Error(err.Error())
	}

	
    return shim.Success(bytes);
}


func getQueryResultForQueryString(stub shim.ChaincodeStubInterface, queryString string) ([]byte, error) {


	

	resultsIterator, err := stub.GetQueryResult(queryString)
	if err != nil {
		fmt.Println("NOT OKAY")
		return nil, err
	}
	defer resultsIterator.Close()

	// buffer is a JSON array containing QueryRecords
	var buffer bytes.Buffer
	buffer.WriteString("[")

	bArrayMemberAlreadyWritten := false
	for resultsIterator.HasNext() {
		queryResponse, err := resultsIterator.Next()
		if err != nil {
			return nil, err
		}
		// Add a comma before array members, suppress it for the first array member
		if bArrayMemberAlreadyWritten == true {
			buffer.WriteString(",")
		}
		buffer.WriteString("{\"Key\":")
		buffer.WriteString("\"")
		buffer.WriteString(queryResponse.Key)
		buffer.WriteString("\"")

		buffer.WriteString(", \"Record\":")
		// Record is a JSON object, so we write as-is
		buffer.WriteString(string(queryResponse.Value))
		buffer.WriteString("}")
		bArrayMemberAlreadyWritten = true
	}

	fmt.Printf("- getQueryResultForQueryString queryResult:\n%s\n", buffer.String())

	return buffer.Bytes(), nil
}

// Query callback representing the query of a chaincode
func (t *SimpleChaincode) query(stub shim.ChaincodeStubInterface, args []string) pb.Response {

	
	attributeValue := string(args[1])

	queryString := fmt.Sprintf("{\"selector\":{\"%s\":\"%s\"}}", "city", attributeValue)

	queryResults, err := getQueryResultForQueryString(stub, queryString)
	if err != nil {
		return shim.Error(err.Error())
	}
	return shim.Success(queryResults)


}

// Query callback representing the query of a chaincode
func (t *SimpleChaincode) normal(stub shim.ChaincodeStubInterface, args []string) pb.Response {

	
	attributeValue := string(args[1])

	fmt.Println(attributeValue)

	queryResults, err := stub.GetState(attributeValue)
	if err != nil {
		return shim.Error(err.Error())
	}

	return shim.Success(queryResults)


}

type AutoGenerated struct {
	A string `json:"a"`
	B string `json:"b"`
}


func (t *SimpleChaincode) api(stub shim.ChaincodeStubInterface, args []string) pb.Response {

	
	phone := "14158586273"
	// QueryEscape escapes the phone string so
	// it can be safely placed inside a URL query
	safePhone := url.QueryEscape(phone)

	fmt.Println(safePhone)

	url := fmt.Sprintf("http://10.224.23.11:3004/app")
	// Build the request
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return shim.Error("queryResults1")
	}

	client := &http.Client{}

	resp, err := client.Do(req)
	if err != nil {
		return shim.Error("queryResults2")
	}

	defer resp.Body.Close()

	var record AutoGenerated

	if err1 := json.NewDecoder(resp.Body).Decode(&record); err != nil {
		fmt.Println(err1)
		return shim.Error("queryResults3")
	}

	bytes, err := json.Marshal(record)
	if err != nil {
		return shim.Error(err.Error())
	}


	return shim.Success(bytes)


}

func (t *SimpleChaincode) check(stub shim.ChaincodeStubInterface, args []string) pb.Response {

	
	phone := "14158586273"
	// QueryEscape escapes the phone string so
	// it can be safely placed inside a URL query
	safePhone := url.QueryEscape(phone)

	fmt.Println(safePhone)

	url := fmt.Sprintf("http://10.224.23.11:3004/app")
	// Build the request
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return shim.Error("queryResults1")
	}

	client := &http.Client{}

	resp, err := client.Do(req)
	if err != nil {
		return shim.Error("queryResults2")
	}

	defer resp.Body.Close()

	var record AutoGenerated

	if err1 := json.NewDecoder(resp.Body).Decode(&record); err != nil {
		fmt.Println(err1)
		return shim.Error("queryResults3")
	}

	bytes, err := json.Marshal(record)
	if err != nil {
		return shim.Error(err.Error())
	}

	err = stub.PutState("name", bytes)
	if err != nil {
		return shim.Error(err.Error())
	}

	return shim.Success(bytes)


}



// Query callback representing the query of a chaincode
func (t *SimpleChaincode) history(stub shim.ChaincodeStubInterface, args []string) pb.Response {

	attributeValue := string(args[1])
	
	resultsIterator, err := stub.GetHistoryForKey(attributeValue)
	if err != nil {
		return shim.Error(err.Error())
	}
	defer resultsIterator.Close()

	// buffer is a JSON array containing historic values for the marble
	var buffer bytes.Buffer
	buffer.WriteString("[")

	bArrayMemberAlreadyWritten := false
	for resultsIterator.HasNext() {
		response, err := resultsIterator.Next()
		if err != nil {
			return shim.Error(err.Error())
		}
		// Add a comma before array members, suppress it for the first array member
		if bArrayMemberAlreadyWritten == true {
			buffer.WriteString(",")
		}
		buffer.WriteString("{\"TxId\":")
		buffer.WriteString("\"")
		buffer.WriteString(response.TxId)
		buffer.WriteString("\"")

		buffer.WriteString(", \"Value\":")
		// if it was a delete operation on given key, then we need to set the
		//corresponding value null. Else, we will write the response.Value
		//as-is (as the Value itself a JSON marble)
		if response.IsDelete {
			buffer.WriteString("null")
		} else {
			buffer.WriteString(string(response.Value))
		}

		buffer.WriteString(", \"Timestamp\":")
		buffer.WriteString("\"")
		buffer.WriteString(time.Unix(response.Timestamp.Seconds, int64(response.Timestamp.Nanos)).String())
		buffer.WriteString("\"")

		buffer.WriteString(", \"IsDelete\":")
		buffer.WriteString("\"")
		buffer.WriteString(strconv.FormatBool(response.IsDelete))
		buffer.WriteString("\"")

		buffer.WriteString("}")
		bArrayMemberAlreadyWritten = true
	}
	buffer.WriteString("]")

	return shim.Success(buffer.Bytes())


}

func main() {
	err := shim.Start(new(SimpleChaincode))
	if err != nil {
		fmt.Printf("Error starting Simple chaincode: %s", err)
	}
}
