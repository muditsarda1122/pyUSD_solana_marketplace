import React, { useState, useEffect } from "react";
import { getProvider } from "../detectProvider";
import { provider as anchorProvider, program } from "../anchorProvider";
import { web3 } from "@coral-xyz/anchor";
import { encode } from "@coral-xyz/anchor/dist/cjs/utils/bytes/bs58";
import axios from "axios";
import "./Home.css";
import {
  getAssociatedTokenAddress,
  getOrCreateAssociatedTokenAccount,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
} from "@solana/spl-token";
import { Connection } from "@solana/web3.js";
const anchor = require("@project-serum/anchor");

const Home: React.FC = () => {
  const [nftData, setNftData] = useState<any[]>([]);
  const [cart, setCart] = useState<any | null>(null);
  const [indexInCart, setIndexInCart] = useState<number | null>(null);
  const [indexToDisplay, setIndexToDisplay] = useState<number[]>([]);

  useEffect(() => {
    const getNftDetails = async () => {
      try {
        const provider = getProvider();

        const nftOwnersResponse = await program.methods
          .getOwners()
          .accounts({
            state: new web3.PublicKey(
              "FzkuJS1zRypEnRtHyBg36Bs6VFEpW1SyVE3FpE2HUpvn"
            ),
            signer: provider.publicKey,
          })
          .view();

        const nftStatesResponse = await program.methods
          .getNftStates()
          .accounts({
            state: new web3.PublicKey(
              "FzkuJS1zRypEnRtHyBg36Bs6VFEpW1SyVE3FpE2HUpvn"
            ),
            signer: provider.publicKey,
          })
          .view();

        const nftMetadataUriResponse = await program.methods
          .getMetadatauri()
          .accounts({
            state: new web3.PublicKey(
              "FzkuJS1zRypEnRtHyBg36Bs6VFEpW1SyVE3FpE2HUpvn"
            ),
            signer: provider.publicKey,
          })
          .view();

        const nftDataPromises = nftMetadataUriResponse.map(
          async (uri: string) => {
            const response = await axios.get(
              `https://tan-legislative-parakeet-190.mypinata.cloud/ipfs/${uri}`
            );
            return response.data;
          }
        );
        const fetchedNftData = await Promise.all(nftDataPromises);

        const data = nftMetadataUriResponse.map(
          (_uri: string, index: number) => ({
            data: fetchedNftData[index],
            owner: encode(nftOwnersResponse[index]),
            state: nftStatesResponse[index],
          })
        );
        console.log(data);

        let indexArray: number[] = [];
        const nftToDisplay = data.filter((nft: any) => nft.state === 0);
        const temp = data.filter((nft: any, index: number) => {
          if (nft.state === 0) {
            indexArray.push(index);
          }
        });
        setIndexToDisplay(indexArray);

        setNftData(nftToDisplay);
      } catch (error) {
        console.error("Error fetching NFT data:", error);
      }
    };

    getNftDetails();
  }, []);

  const handleBuyClick = (index: number) => {
    if (cart) {
      alert("Only one item in cart allowed");
      return; // Only one item in cart allowed
    }

    console.log("index: ", index);
    console.log("index in cart: ", indexToDisplay[index]);

    // Move the selected NFT to the cart
    setCart(nftData[index]);
    setIndexInCart(indexToDisplay[index]);
    console.log(nftData[index]);

    // Remove the selected NFT from the list
    const updatedNftData = nftData.filter((_, i) => i !== index);
    setNftData(updatedNftData);
  };

  const handlePayNowClick = async () => {
    if (!cart) return;

    // Implement the payment logic here
    console.log("Processing payment for NFT:", cart);

    try {
      const provider = getProvider();

      if (provider.publicKey.toBase58() === cart.owner) {
        alert("You cannot buy your own NFT");
        return;
      }

      const sale_lamport = new anchor.BN(
        Number(cart.data.attributes[5].value) * 1000000
      ); // as decimals are 6, 10^6 = 1000000
      console.log(sale_lamport.toString());

      // find sender's ata
      const senderAta = await getAssociatedTokenAddress(
        new web3.PublicKey("CXk2AMBfi3TwaEL2468s6zP8xq9NxTXjp9gjMgzeUynM"), // PYUSD mint account
        new web3.PublicKey(provider.publicKey),
        false,
        TOKEN_2022_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      );
      console.log("sender ata: ", senderAta.toBase58());

      // find recipient's ata
      const recipientAta = await getAssociatedTokenAddress(
        new web3.PublicKey("CXk2AMBfi3TwaEL2468s6zP8xq9NxTXjp9gjMgzeUynM"), // PYUSD mint account
        new web3.PublicKey(cart.owner),
        false,
        TOKEN_2022_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      );
      console.log("recipient ata: ", recipientAta.toBase58());
      console.log("token 2022 program id: ", TOKEN_2022_PROGRAM_ID.toBase58());

      console.log("transferring of PYUSD initiated");
      const transferPyUsdTx = await program.methods
        .transferPyusd(indexInCart, sale_lamport)
        .accounts({
          state: new web3.PublicKey(
            "FzkuJS1zRypEnRtHyBg36Bs6VFEpW1SyVE3FpE2HUpvn"
          ),
          mint: new web3.PublicKey(
            "CXk2AMBfi3TwaEL2468s6zP8xq9NxTXjp9gjMgzeUynM"
          ), // PYUSD mint account
          sender: new web3.PublicKey(provider.publicKey),
          recipient: new web3.PublicKey(cart.owner),
          sender_token_account: senderAta,
          recipient_token_account: recipientAta,
          token_program: TOKEN_2022_PROGRAM_ID,
          system_program: web3.SystemProgram.programId,
          associated_token_program: ASSOCIATED_TOKEN_PROGRAM_ID,
        })
        .rpc();
      console.log("transfer PYUSD tx signature: ", transferPyUsdTx);
      alert("Payment successful!");
    } catch (error) {
      console.log("error calling buy_nft: ", error);
    }

    // After payment is processed, clear the cart
    setCart(null);
    setIndexInCart(null);
  };

  return (
    <div>
      <h1>List of NFTs</h1>
      <div className="nft-list">
        {nftData.map((nft, index) => (
          <div key={index} className="nft-card">
            <img
              src={`https://${nft.data.image}`}
              alt="NFT"
              className="nft-image"
            />
            <div className="nft-details">
              <h3>Name: {nft.data.name}</h3>
              <p>
                <strong>Owner:</strong>{" "}
                {nft.owner
                  ? `${nft.owner.slice(0, 4)}..${nft.owner.slice(-4)}`
                  : "N/A"}
              </p>
              <p>
                <strong>Address:</strong> {nft.data.attributes[4].value}
              </p>
              <p>
                <strong>Price: INR</strong> {nft.data.attributes[5].value}
              </p>
              <p>
                <strong>Rooms:</strong> {nft.data.attributes[0].value}
              </p>
              <p>
                <strong>Bathrooms:</strong> {nft.data.attributes[1].value}
              </p>
              <p>
                <strong>Parking:</strong> {nft.data.attributes[2].value}
              </p>
              <p>
                <strong>Area:</strong> {nft.data.attributes[3].value}
              </p>
              <button onClick={() => handleBuyClick(index)}>Buy</button>
            </div>
          </div>
        ))}
      </div>
      <div>
        <h2>Cart</h2>
        {cart ? (
          <div className="cart-item">
            <img
              src={`https://${cart.data.image}`}
              alt="Cart NFT"
              className="nft-image"
            />
            <div className="nft-details">
              <h3>Name: {cart.data.name}</h3>
              <p>
                <strong>Owner:</strong>{" "}
                {cart.owner
                  ? `${cart.owner.slice(0, 4)}..${cart.owner.slice(-4)}`
                  : "N/A"}
              </p>
              <p>
                <strong>Address:</strong> {cart.data.attributes[4].value}
              </p>
              <p>
                <strong>Price:</strong> {cart.data.attributes[5].value}
              </p>
              <p>
                <strong>Rooms:</strong> {cart.data.attributes[0].value}
              </p>
              <p>
                <strong>Bathrooms:</strong> {cart.data.attributes[1].value}
              </p>
              <p>
                <strong>Parking:</strong> {cart.data.attributes[2].value}
              </p>
              <p>
                <strong>Area:</strong> {cart.data.attributes[3].value}
              </p>
              <button onClick={handlePayNowClick}>Pay Now</button>
            </div>
          </div>
        ) : (
          <p>No item in cart</p>
        )}
      </div>
    </div>
  );
};

export default Home;
