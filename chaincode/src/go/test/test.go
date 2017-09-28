
package main


import (
	"fmt"

	"github.com/hyperledger/fabric/core/chaincode/shim"
	pb "github.com/hyperledger/fabric/protos/peer"
)

// SimpleChaincode example simple Chaincode implementation
type SimpleChaincode struct {
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

	if args[0] == "query" {
		// queries an entity state
		return t.query(stub, args)
	}
	if args[0] == "move" {
		// Deletes an entity from its state
		return t.move(stub, args)
	}
	return shim.Error("Unknown action, check the first argument, must be one of 'delete', 'query', or 'move'")
}

func (t *SimpleChaincode) move(stub shim.ChaincodeStubInterface, args []string) pb.Response {
	// must be an invoke
	var Data string;
	Data = args[1];

	// Write the state back to the ledger
	err := stub.PutState("data", []byte(Data))
	if err != nil {
		return shim.Error(err.Error())
	}

	err = stub.SetEvent("evtsender", []byte("This is my new data"))
	if err != nil {
		return shim.Error(err.Error())
	}

    return shim.Success([]byte(Data));
}


// Query callback representing the query of a chaincode
func (t *SimpleChaincode) query(stub shim.ChaincodeStubInterface, args []string) pb.Response {

	
	if args[1] != "sakaar" {
		return shim.Error("Not founddddddddddddddddddddddddddd")
	}
	// Get the state from the ledger
	Avalbytes, err := stub.GetState("data")
	if err != nil {
		return shim.Error("Not found")
	}



	return shim.Success(Avalbytes)
}

func main() {
	err := shim.Start(new(SimpleChaincode))
	if err != nil {
		fmt.Printf("Error starting Simple chaincode: %s", err)
	}
}
