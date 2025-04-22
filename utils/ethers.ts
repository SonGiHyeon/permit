import { ethers } from 'ethers';
import { abi, address as contractAddress } from '../abis/MyGasslessToken.json';

const ownerPrivateKey = process.env.OWNER_PRIVATE_KEY || '';
const spenderPrivateKey = process.env.SPENDER_PRIVATE_KEY || '';

const provider = new ethers.JsonRpcProvider('http://127.0.0.1:7545');

export const owner = new ethers.Wallet(ownerPrivateKey, provider);
export const spender = new ethers.Wallet(spenderPrivateKey, provider);
export const recipient = ethers.Wallet.createRandom();

export const contractByOwner = new ethers.Contract(contractAddress, abi, owner);
export const contractBySpender = new ethers.Contract(contractAddress, abi, spender);

export const ownerBalance = async () => {
  return await provider.getBalance(owner.address);
};

export const getBalance = async (address: string) => {
  try {
    return await contractByOwner.balanceOf(address);
  } catch (error) {
    console.error('Error in getBalance:', error);
  }
};

export const getAllowance = async (owner: string, spender: string) => {
  try {
    return await contractByOwner.allowance(owner, spender);
  } catch (error) {
    console.error('Error in getAllowance:', error);
  }
};

export const permit = async () => {
  try {
    const name = await contractByOwner.name();
    const version = '1';
    const chainId = (await provider.getNetwork()).chainId;

    const nonce = await contractByOwner.nonces(owner.address);
    const deadline = Math.floor(Date.now() / 1000) + 3600;
    const value = await contractByOwner.balanceOf(owner.address);

    const domain = {
      name,
      version,
      chainId,
      verifyingContract: contractAddress,
    };

    const types = {
      Permit: [
        { name: 'owner', type: 'address' },
        { name: 'spender', type: 'address' },
        { name: 'value', type: 'uint256' },
        { name: 'nonce', type: 'uint256' },
        { name: 'deadline', type: 'uint256' },
      ],
    };

    const message = {
      owner: owner.address,
      spender: spender.address,
      value,
      nonce,
      deadline,
    };

    const signature = await owner.signTypedData(domain, types, message);
    const { v, r, s } = ethers.Signature.from(signature);

    const tx = await contractBySpender.permit(
      owner.address,
      spender.address,
      value,
      deadline,
      v,
      r,
      s
    );
    await tx.wait();
  } catch (error) {
    console.error('Error in permit:', error);
  }
};

export const tranferFrom = async (from: string, to: string, value: bigint) => {
  try {
    await contractBySpender.transferFrom(from, to, value);
  } catch (error) {
    console.error('Error in tranferFrom:', error);
  }
};

export const gasLess = async () => {
  const value = ethers.parseEther('10');

  const nonce = await contractByOwner.nonces(owner.address);
  const deadline = Math.floor(Date.now() / 1000) + 3600;
  const chainId = (await provider.getNetwork()).chainId;
  const name = await contractByOwner.name();

  const domain = {
    name,
    version: '1',
    chainId,
    verifyingContract: contractByOwner.target.toString(),
  };

  const types = {
    Permit: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
      { name: 'value', type: 'uint256' },
      { name: 'nonce', type: 'uint256' },
      { name: 'deadline', type: 'uint256' },
    ],
  };

  const message = {
    owner: owner.address,
    spender: spender.address,
    value,
    nonce,
    deadline,
  };

  // console.log('--- 상태: permit 이전 ---');
  const ownerTokenBefore = await contractByOwner.balanceOf(owner.address);
  const recipientTokenBefore = await contractByOwner.balanceOf(recipient.address);
  const spenderEthBefore = await provider.getBalance(spender.address);

  // console.log('owner 토큰:', ethers.formatEther(ownerTokenBefore));
  // console.log('recipient 토큰:', ethers.formatEther(recipientTokenBefore));
  // console.log('spender ETH:', ethers.formatEther(spenderEthBefore));

  const signature = await owner.signTypedData(domain, types, message);
  const { v, r, s } = ethers.Signature.from(signature);

  const permitTx = await contractBySpender.permit(
    owner.address,
    spender.address,
    value,
    deadline,
    v,
    r,
    s
  );
  await permitTx.wait();

  console.log('✅ permit 호출 완료');

  const tx = await contractBySpender.transferFrom(owner.address, recipient.address, value);
  await tx.wait();

  // console.log('✅ transferFrom 호출 완료');

  const ownerTokenAfter = await contractByOwner.balanceOf(owner.address);
  const recipientTokenAfter = await contractByOwner.balanceOf(recipient.address);
  const spenderEthAfter = await provider.getBalance(spender.address);

  // console.log('--- 상태: transferFrom 이후 ---');
  // console.log('owner 토큰:', ethers.formatEther(ownerTokenAfter));
  // console.log('recipient 토큰:', ethers.formatEther(recipientTokenAfter));
  // console.log('spender ETH:', ethers.formatEther(spenderEthAfter));
  // console.log('가스 사용량 추정:', ethers.formatEther(spenderEthBefore - spenderEthAfter));

  // console.log('📌 검증 결과');
  // console.log('🔸 토큰 전송 성공?', ownerTokenAfter < ownerTokenBefore && recipientTokenAfter > recipientTokenBefore);
  // console.log('🔸 가스 대납 성공?', spenderEthAfter < spenderEthBefore);
};

if (require.main === module) {
  gasLess().catch((err) => {
    console.error('❌ 실행 중 에러 발생:', err);
  });
}

export {
  provider, // ✅ 이 줄 추가!
};
