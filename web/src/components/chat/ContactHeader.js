import React from "react";
import Avatar from "components/Avatar";
import { Row } from "reactstrap";

/**
 * Contacts Header.
 */
const ContactHeader = (props) => (
  <Row className="heading">
    {/* Use optional chaining (?) to safely access avatar */}
    <Avatar src={props.user?.avatar} />
    <div>Contacts</div>
    <div className="mr-auto nav-link" onClick={props.toggle}>
      <i className="fa fa-bars" />
    </div>
  </Row>
);

export default ContactHeader;
