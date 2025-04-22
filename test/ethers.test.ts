import {
  ownerBalance,
  owner,
  spender,
  recipient,
  getBalance,
  getAllowance,
  permit,
  tranferFrom,
  contractByOwner,
  contractBySpender,
  provider,
} from '../utils/ethers';
import { ethers } from 'hardhat';
import { expect } from 'chai';


describe('ethers 구현 테스트', function () {
  it('getBalance는 인자로 받는 address의 잔액을 리턴해야 합니다.(balanceOf)', async function () {
    const balance = await getBalance(owner.address);

    expect(typeof balance).to.equal('bigint');
  });

  it('getAllowance는 Owner가 Spender에게 허용한 금액을 리턴해야 합니다.(allowance)', async function () {
    const allowance = await getAllowance(owner.address, spender.address);

    expect(typeof allowance).to.equal('bigint');
  });

  it('permit을 실행시키면 Owner의 전체 토큰 잔액과 Spender가 쓸 수 있는 양이 같아야 합니다.(이 과정에서 owner의 coin은 가스비로 소모되지 않아야 합니다)', async function () {
    const ownerTokenBalance = await getBalance(owner.address);
    const prevOwnerbalance = await ownerBalance();

    await permit();

    const allowance = await getAllowance(owner.address, spender.address);
    const afterOwnerbalance = await ownerBalance();

    expect(ownerTokenBalance).to.equal(allowance);
    expect(prevOwnerbalance).to.equal(afterOwnerbalance);
  });

  it('tranferFrom을 실행시키면 from의 토큰이 to에게 value 만큼 전송되어야 합니다.(이 과정에서 owner의 coin은 가스비로 소모되지 않아야 합니다. Spender가 transferFrom을 실행하도록 해주세요.)', async function () {
    const prevRecipientTokenBalance = await getBalance(recipient.address);
    const prevOwnerbalance = await ownerBalance();

    const value = ethers.parseEther('1');

    await tranferFrom(owner.address, recipient.address, value);

    const afterRecipientTokenBalance = await getBalance(recipient.address);
    const afterOwnerbalance = await ownerBalance();

    expect(afterRecipientTokenBalance).to.be.greaterThan(
      prevRecipientTokenBalance
    );
    expect(prevOwnerbalance).to.equal(afterOwnerbalance);
  });

  // B -> C한데 토큰을 보내는데 B는 가스비를 소비하지 않고 A가 대신 가스를 납부헤야 됨(gasLess)
  it('permit 함수를 이용해서 spender와 owner, value가 정해지면, transferFrom 함수를 이용해서 owner(from)에서 receiver(to)로 value를 보내야 한다.(단, spender의 balance만 감소해야 한다.)', async function () {
    const value = ethers.parseEther('10');

    // 준비: permit 서명 정보
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

    const signature = await owner.signTypedData(domain, types, message);
    const { v, r, s } = ethers.Signature.from(signature);

    // ✅ 잔액 확인 전
    const ownerTokenBefore = await contractByOwner.balanceOf(owner.address);
    const recipientTokenBefore = await contractByOwner.balanceOf(recipient.address);
    const spenderEthBefore = await provider.getBalance(spender.address);

    // spender가 permit 실행
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

    // spender가 transferFrom 실행
    const tx = await contractBySpender.transferFrom(
      owner.address,
      recipient.address,
      value
    );
    const receipt = await tx.wait();

    // ✅ 잔액 확인 후
    const ownerTokenAfter = await contractByOwner.balanceOf(owner.address);
    const recipientTokenAfter = await contractByOwner.balanceOf(recipient.address);
    const spenderEthAfter = await provider.getBalance(spender.address);

    // ✅ 토큰 이동 확인
    expect(ownerTokenAfter).to.equal(ownerTokenBefore - value);
    expect(recipientTokenAfter).to.equal(recipientTokenBefore + value);

    // ✅ spender가 ETH로 가스를 낸 것 확인 (잔액이 줄었는지)
    expect(spenderEthAfter).to.be.lt(spenderEthBefore); // ETH 잔액이 줄어야 함

    console.log('Spender used ETH for gas:', ethers.formatEther(spenderEthBefore - spenderEthAfter));
  });
})