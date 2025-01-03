import React from "react";
import { withRouter } from "react-router-dom";
import Avatar from "components/Avatar";
import {
  Row,
  UncontrolledDropdown,
  DropdownToggle,
  DropdownMenu,
  DropdownItem,
  Button
} from "reactstrap";
import moment from "moment";

/**
 * Chat Header.
 */
const ChatHeader = (props) => {
  const status = () => {
    if (props.typing) return "Typing now";
    if (props.contact.status === true) return "Online now";
    if (props.contact.status) return moment(props.contact.status).fromNow();
    return "";
  };

  const handleCall = () => {
    console.log("[ChatHeader] Call button clicked");
    if (props.onCall) {
      props.onCall(props.contact);
    }
  };

  return (
    <Row
      className="heading m-0 align-items-center w-100"
      style={{ padding: "0.5rem", justifyContent: "space-between" }}
    >
      {/* LEFT: Avatar + name/status */}
      <div
        className="d-flex align-items-center"
        onClick={props.toggle}
        style={{ cursor: "pointer" }}
      >
        <Avatar src={props.contact?.avatar} />
        <div className="text-left ml-2">
          <div>{props.contact?.name || ""}</div>
          <small>{status()}</small>
        </div>
      </div>

      {/* RIGHT: Call button + three-dots side by side */}
      <div className="d-flex align-items-center" style={{ marginLeft: "0.5rem" }}>
        {/* Call button (green) */}
        <Button color="success" onClick={handleCall} className="mr-2">
          <i className="fa fa-phone" />
        </Button>

        {/* Three-dots menu */}
        <UncontrolledDropdown>
          <DropdownToggle
            tag="a"
            className="nav-link"
            style={{ cursor: "pointer" }}
          >
            <i className="fa fa-ellipsis-v" />
          </DropdownToggle>
          <DropdownMenu>
            <DropdownItem onClick={() => props.history.push("/password")}>Change Password</DropdownItem>
            <DropdownItem divider />
            <DropdownItem onClick={props.logout}>Logout</DropdownItem>
          </DropdownMenu>
        </UncontrolledDropdown>
      </div>
    </Row>
  );
};

export default withRouter(ChatHeader);
