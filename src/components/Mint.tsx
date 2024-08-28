import { useState, useEffect } from "react";
import React from "react";
import { provider, program } from "../anchorProvider";
import { web3 } from "@coral-xyz/anchor";
import {
  getAssociatedTokenAddress,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { getProvider } from "../detectProvider";

const Mint: React.FC = () => {
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [price, setPrice] = useState<any | null>(0);
  const [rooms, setRooms] = useState<any | null>(0);
  const [bathrooms, setBathrooms] = useState<any | null>(0);
  const [parking, setParking] = useState<any | null>(0);
  const [area, setArea] = useState<any | null>(0);
  const [image, setImage] = useState<any | null>(null);
  const [uri, setUri] = useState<string>("");
  const [stateInitialized, setStateInitialized] = useState<boolean>(false);
  const [mintAccount, setMintAccount] = useState<any | null>("");
  const [associatedTokenAccount, setAssociatedTokenAccount] = useState<
    any | null
  >("");
  const [currentProvider, setCurrentProvider] = useState<any | null>("");
  const [stateAccount, setStateAccount] = useState<web3.PublicKey>(
    new web3.PublicKey("FzkuJS1zRypEnRtHyBg36Bs6VFEpW1SyVE3FpE2HUpvn")
  ); //checking

  const pinataGatewayUrl = process.env.REACT_APP_PINATA_GATEWAY_URL;

  useEffect(() => {
    const checkInitialization = async () => {
      try {
        const stateAccountPublicKey = new web3.PublicKey(
          "FzkuJS1zRypEnRtHyBg36Bs6VFEpW1SyVE3FpE2HUpvn"
        );

        const stateAccount = await provider.connection.getAccountInfo(
          stateAccountPublicKey
        );
        if (stateAccount) {
          setStateInitialized(true);
        }
      } catch (error) {
        console.error("Error checking initialization:", error);
      }
    };

    checkInitialization();
  }, []);

  const handleFileChange = (event: any) => {
    if (!event.target.files) return;
    setImage(event.target.files[0]);
  };

  const initializeState = async () => {
    try {
      const tx = await program.methods
        .initialize()
        .accounts({
          state: new web3.PublicKey(
            "FzkuJS1zRypEnRtHyBg36Bs6VFEpW1SyVE3FpE2HUpvn" // state account derived from solana pg, not by seeds in code
          ),
          signer: provider.wallet.publicKey,
          systemProgram: web3.SystemProgram.programId,
        })
        .rpc();
      console.log("Initialize tx signature: ", tx);

      setStateInitialized(true);
    } catch (error) {
      console.error("Error initializing state:", error);
    }
  };

  const mintNft = async (e: { preventDefault: () => void }) => {
    e.preventDefault();

    // check if state is initialized, if not, do it
    if (!stateInitialized) {
      alert("State is not initialized. Initializing the state first.");
      await initializeState();
      return;
    }

    try {
      const provider = getProvider();
      setCurrentProvider(provider._publicKey.toString());

      console.log("calling get counter function");
      const currentCounter = await program.methods
        .getCounter()
        .accounts({
          state: new web3.PublicKey(
            "FzkuJS1zRypEnRtHyBg36Bs6VFEpW1SyVE3FpE2HUpvn"
          ),
          signer: provider.publicKey,
        })
        .view();
      console.log("current counter: ", currentCounter);

      const counterBytes = Buffer.alloc(4);
      counterBytes.writeUInt32LE(currentCounter, 0);
      const seeds = [
        Buffer.from("mint"),
        provider.publicKey.toBuffer(),
        counterBytes,
      ];
      const [mintAccountPublicKey] = web3.PublicKey.findProgramAddressSync(
        seeds,
        program.programId
      );
      setMintAccount(mintAccountPublicKey.toBase58());

      const ata = await getAssociatedTokenAddress(
        mintAccountPublicKey,
        new web3.PublicKey(provider._publicKey.toString()),
        false
      );
      setAssociatedTokenAccount(ata.toBase58());

      // Upload image to IPFS
      const formData = new FormData();
      formData.append("file", image);
      const options = JSON.stringify({
        cidVersion: 0,
      });
      formData.append("pinataOptions", options);
      const metadata = JSON.stringify({
        name: name,
      });
      formData.append("pinataMetadata", metadata);

      const res = await fetch(
        "https://api.pinata.cloud/pinning/pinFileToIPFS",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.REACT_APP_VITE_PINATA_JWT}`,
          },
          body: formData,
        }
      );
      const resDataJson = await res.json();
      const tokenImageUri = `${pinataGatewayUrl}/ipfs/${resDataJson.IpfsHash}`;
      console.log("NFT image saved to IPFS! Creating metadata...");
      console.log("token image uri: ", tokenImageUri);

      // create metadata
      const data = JSON.stringify({
        pinataContent: {
          name: name,
          symbol: name.toUpperCase(),
          description: "Real Estate NFT",
          image: tokenImageUri,
          attributes: [
            {
              trait_type: "numberOfRooms",
              value: rooms,
            },
            {
              trait_type: "numberOfBathrooms",
              value: bathrooms,
            },
            {
              trait_type: "numberOfParking",
              value: parking,
            },
            {
              trait_type: "propertyAreaInSqft",
              value: area,
            },
            {
              trait_type: "address",
              value: address,
            },
            {
              trait_type: "price",
              value: price,
            },
            {
              trait_type: "mintAccount",
              value: mintAccountPublicKey.toBase58(),
            },
            {
              trait_type: "mintAuthority",
              value: currentProvider,
            },
            {
              trait_type: "associatedTokenAccount",
              value: ata.toBase58(),
            },
          ],
          properties: {},
          collection: {},
        },
        pinataMetadata: {
          name: "Metadata.json",
        },
      });

      // send metadata to IPFS
      const res2 = await fetch(
        "https://api.pinata.cloud/pinning/pinJSONToIPFS",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.REACT_APP_VITE_PINATA_JWT}`,
            "Content-Type": "application/json",
          },
          body: data,
        }
      );
      const resData2 = await res2.json();
      setUri(resData2.IpfsHash); // change here made
      console.log("NFT metadata saved to IPFS!");
      console.log("uri: ", resData2.IpfsHash);

      const tx = await program.methods
        .initNft(resData2.IpfsHash) //change here made
        .accounts({
          state: stateAccount,
          signer: provider.publicKey,
          mint: mintAccountPublicKey.toBase58(),
          associated_token_account: ata.toBase58(),
          token_program: TOKEN_PROGRAM_ID,
          associated_token_program: ASSOCIATED_TOKEN_PROGRAM_ID,
          system_program: web3.SystemProgram.programId,
          rent: web3.SYSVAR_RENT_PUBKEY,
        })
        .rpc();

      alert("minted NFT successfully");

      console.log("InItNFT tx signature: ", tx);

      console.log("mintAccountPublicKey: ", mintAccount.toBase58());
      console.log("ata: ", associatedTokenAccount.toBase58());
      alert("NFT minted successfully");
    } catch (error) {
      console.log(error);
    }
  };

  return (
    <>
      <h1>Mint your NFT</h1>
      {/* <form onSubmit={mintNft}> */}
      <label>
        Name:
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
      </label>
      <br />
      <br />
      <label>
        Address:
        <input
          type="text"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          required
        />
      </label>
      <br />
      <br />
      <label>
        Price:
        <input
          type="number"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          required
        />
      </label>
      <br />
      <br />
      <label>
        Rooms:
        <input
          type="number"
          value={rooms}
          onChange={(e) => setRooms(e.target.value)}
          required
        />
      </label>
      <br />
      <br />
      <label>
        Bathrooms:
        <input
          type="number"
          value={bathrooms}
          onChange={(e) => setBathrooms(e.target.value)}
          required
        />
      </label>
      <br />
      <br />
      <label>
        Parking:
        <input
          type="number"
          value={parking}
          onChange={(e) => setParking(e.target.value)}
          required
        />
      </label>
      <br />
      <br />
      <label>
        Area:
        <input
          type="number"
          value={area}
          onChange={(e) => setArea(e.target.value)}
          required
        />
      </label>
      <br />
      <br />
      <label>
        Image:
        <input
          type="file"
          accept="image/*"
          onChange={(e) => handleFileChange(e)}
          required
        />
      </label>
      <br />
      <br />
      <button onClick={mintNft}>MINT</button>
      {/* </form> */}
    </>
  );
};

export default Mint;
