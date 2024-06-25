// SPDX-License-Identifier: MIT
pragma solidity 0.8.18;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {ICopyTradingFees} from "contracts/interfaces/ICopyTradingFees.sol";
import {Owned} from "contracts/utils/Owned.sol";

contract CopyTradingFees is ICopyTradingFees, Owned {
    address executor;
    address feeReceiver;
    mapping(address => bool) public _paymentTokens;
    mapping(uint96 => Fee) public _fees;

    constructor(address _owner, address _executor) Owned(_owner) {
        executor = _executor;
        feeReceiver = _owner;
        emit SetExecutor(executor);
        emit ChangeFeeReceiver(feeReceiver);
    }

    function setExecutor(address _executor) external onlyOwner {
        if (_executor == address(0)) {
            revert AddressZero();
        }
        executor = _executor;
        emit SetExecutor(executor);
    }

    function changeFeeReceiver(address _receiver) external onlyOwner {
        if (_receiver == address(0)) {
            revert AddressZero();
        }
        feeReceiver = _receiver;
        emit ChangeFeeReceiver(feeReceiver);
    }

    function setPaymentToken(address _token, bool _enable) external onlyOwner {
        if (_token == address(0)) {
            revert AddressZero();
        }
        _paymentTokens[_token] = _enable;
        emit SetPaymentToken(_token, _enable);
    }

    function transferOwnership(
        address newOwner
    ) public override(Owned) onlyOwner {
        super.transferOwnership(newOwner);
    }

    function chargeFee(
        uint96 _id,
        address _account,
        uint128 _size,
        uint128 _fee,
        address _token
    ) external {
        if (msg.sender != executor) {
            revert OnlyExecutor();
        }
        if (!_paymentTokens[_token]) {
            revert TokenNotSupported();
        }
        if (_size == 0) {
            revert SizeZero();
        }
        if (_id == 0) {
            revert InvalidFeeId();
        }
        if (_fees[_id].size > 0) {
            revert AlreadyCharged();
        }
        IERC20(_token).transferFrom(
            _account,
            feeReceiver,
            _fromD18(_token, _fee)
        );
        _fees[_id] = Fee({id: _id, account: _account, size: _size, fee: _fee});
        emit ChargeFee(_id, _account, _size, _fee, feeReceiver);
    }

    function withdrawEth(address receiver, uint256 amount) external onlyOwner {
        if (receiver == address(0)) {
            revert AddressZero();
        }
        if (amount > 0) {
            (bool success, ) = payable(receiver).call{value: amount}("");
            if (!success) revert EthWithdrawalFailed();
        }
    }

    function clearStuckBalance(
        address token,
        address receiver
    ) external onlyOwner {
        if (receiver == address(0)) {
            revert AddressZero();
        }
        IERC20(token).transfer(
            receiver,
            IERC20(token).balanceOf(address(this))
        );
    }

    receive() external payable {}

    function _fromD18(
        address _token,
        uint256 _amount
    ) internal view returns (uint256) {
        /// @dev convert to fund asset decimals
        return (_amount * 10 ** IERC20Metadata(_token).decimals()) / 10 ** 18;
    }

    function _toD18(
        address _token,
        uint256 _amount
    ) internal view returns (uint256) {
        /// @dev convert to fund asset decimals
        return (_amount * 10 ** 18) / 10 ** IERC20Metadata(_token).decimals();
    }
}
